import { builtinModules } from "node:module";
import { runInNewContext } from "node:vm";
import { build, type BuildOptions } from "esbuild";
import { assert, describe, expect, test } from "vitest";

// the conditions and platform wrangler bundles a worker with
const workerBuild = {
	bundle: true,
	write: false,
	metafile: true,
	minify: true,
	platform: "browser",
	conditions: ["workerd", "worker", "browser"],
	logLevel: "silent",
} satisfies BuildOptions;

const nodeBuiltins = new Set(
	builtinModules.flatMap((name) => [name, `node:${name}`]),
);

// globals every runtime with web streams has, and nothing Node specific
const webGlobals = {
	AbortController,
	console,
	queueMicrotask,
	ReadableStream,
	setTimeout,
	TextEncoder,
	TransformStream,
	WritableStream,
};

describe("the runtime-neutral entry point", () => {
	test("bundles for a worker without any Node built-in", async () => {
		const result = await build({
			...workerBuild,
			entryPoints: ["lib/index.ts"],
			format: "esm",
		});

		const inputs = Object.keys(result.metafile.inputs);
		const imports = Object.values(result.metafile.inputs).flatMap((input) =>
			input.imports.map(({ path }) => path),
		);
		const [output] = result.outputFiles;
		assert(output);

		expect(result.errors).toStrictEqual([]);
		expect(imports.filter((path) => nodeBuiltins.has(path))).toStrictEqual([]);
		expect(inputs.filter((path) => path.includes("node:"))).toStrictEqual([]);

		// Workers refuse code generation from strings
		expect(output.text).not.toMatch(/\bnew Function\(|\beval\(/u);
		expect(output.text).not.toMatch(/\brequire\(/u);
		expect(output.contents.byteLength).toBeLessThan(64 * 1024);
	});

	test("logs in a context with web globals only", async () => {
		const result = await build({
			...workerBuild,
			entryPoints: ["lib/index.ts"],
			format: "iife",
			globalName: "loggerModule",
		});
		const [output] = result.outputFiles;
		assert(output);

		const lines: unknown[] = [];
		const script = `${output.text}
			const { Logger, jsonTransformer, createRedactProcessor } = loggerModule;
			const logger = new Logger({
				destination: new WritableStream({ write: (line) => lines.push(line) }),
				processors: [createRedactProcessor({ paths: ["password"] })],
				transformer: jsonTransformer,
			});
			logger.info({ user: "max", password: "trustno1" }, "signed in");
			logger.error(new Error("boom"));
			logger.end();
		`;

		const context = { ...webGlobals, lines };
		const ended: unknown = runInNewContext(script, context);

		expect(
			runInNewContext(
				"typeof process + typeof require + typeof Buffer",
				context,
			),
		).toBe("undefinedundefinedundefined");
		await ended;
		expect(lines.map((line) => JSON.parse(String(line)))).toMatchObject([
			{ msg: "signed in", user: "max", password: "[REDACTED]" },
			{ msg: "boom", error: { message: "boom" } },
		]);
	});

	test("the Node entry point fails the same build", async () => {
		await expect(
			build({ ...workerBuild, entryPoints: ["lib/node.ts"], format: "esm" }),
		).rejects.toThrow(/node:os/u);
	});
});
