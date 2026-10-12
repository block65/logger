# @block65/logger

A structured logger built on web streams. The main entry point runs anywhere
web streams do, Cloudflare Workers included, and `@block65/logger/node` adds a
logger that configures itself for the platform it finds.

```sh
pnpm add @block65/logger
```

The package ships TypeScript source. Use it through a bundler (wrangler, Vite,
esbuild) or a TypeScript-aware runtime, because Node does not strip types
inside `node_modules`.

## Logging

```ts
import { jsonTransformer, Level, Logger } from "@block65/logger";

const logger = new Logger({
	destination: new WritableStream({
		write(line) {
			console.log(line);
		},
	}),
	transformer: jsonTransformer,
	level: Level.Debug,
	context: { service: "api" },
});

logger.info("listening on %d", 8080);
logger.warn({ userId: "u_1" }, "slow request took %dms", 1200);
logger.error(new Error("connection lost"));
logger.error({ err, requestId: "r_1" }, "request failed");

await logger.flush();
```

Each call takes a message template with printf-style arguments, an object of
data with an optional template, or an error. An `Error`, or one under the `err`
key of the data, is serialized into the data and kept on the log as `err`.

| level   | value |
| ------- | ----- |
| `Trace` | 10    |
| `Debug` | 20    |
| `Info`  | 30    |
| `Warn`  | 40    |
| `Error` | 50    |
| `Fatal` | 60    |

`Silent` is 0. `parseLevel("warn")` reads a level name in any case.

## Processors and transformers

A processor takes a log and returns it changed. Processors run in order, each
on the output of the one before, and a processor that throws is skipped. The
transformer runs last and returns what the destination receives.

```ts
import {
	createRedactProcessor,
	jsonTransformer,
	Logger,
} from "@block65/logger";

const logger = new Logger({
	destination,
	processors: [
		createRedactProcessor({ paths: ["password", "headers.authorization"] }),
		(log) => ({ ...log, ctx: { ...log.ctx, region: "syd" } }),
	],
	transformer: jsonTransformer,
});
```

| transformer                     | writes                                         |
| ------------------------------- | ---------------------------------------------- |
| `jsonTransformer`               | one JSON line, data at the top level           |
| `cliTransformer`                | one readable line, for a terminal or a console |
| `createCliTransformer(options)` | `cliTransformer` with fixed options            |

The CLI options are `color` (off by default) and `timestamps` (on by default).
The redact processor redacts a copy, so the caller's object keeps its values.

## Child loggers

```ts
const requestLogger = logger.child(
	{ requestId: "r_1" },
	{ level: Level.Trace },
);
requestLogger.info("started");
```

A child adds its data to every log, then writes through the parent's
processors and transformer. Its level defaults to the parent's, and its
`context` option replaces the parent's context.

## Lifecycle and events

`flush()` resolves when every log written so far, children's included, has
reached the destination. `end()` flushes and closes the destination, and
`destroy()` flushes and aborts it. Logs written after either are dropped.

```ts
logger.on("error", ({ data }) => reportToSomewhere(data));
logger.on("log", ({ data }) => metrics.count(data.level));
```

The events are `log`, `error`, `flush` and `end`. A listener receives
`{ name, data }`.

## Node

```ts
import { createLogger } from "@block65/logger/node";

const logger = createLogger();
```

`createLogger()` writes to stdout and picks the format from the environment:

| environment                                    | format                            |
| ---------------------------------------------- | --------------------------------- |
| `AWS_LAMBDA_FUNCTION_VERSION`                  | CloudWatch                        |
| `ECS_AVAILABLE_LOGGING_DRIVERS` with `awslogs` | CloudWatch, with pid and hostname |
| `K_CONFIGURATION`, `K_SERVICE`, `K_REVISION`   | Cloud Logging, with pid and host  |
| a TTY, or `CI`                                 | CLI, coloured on a colour TTY     |
| anything else                                  | JSON lines                        |

The level is `options.level`, then `LOG_LEVEL`, then `trace` when `NODE_ENV`
is `development`, then `info`. `@block65/logger/node` also exports everything
from the main entry point.

## Migrating from 13.x

- `createLogger` moved to `@block65/logger/node`. The main entry point now
  imports nothing from Node, so it bundles for Workers and browsers.
- The Sentry listener and `@block65/logger/sentry` are gone. Forward errors
  from an `error` level listener instead:

  ```ts
  logger.on("log", ({ data: log }) => {
  	if (log.level >= Level.Error && log.err) {
  		Sentry.captureException(log.err);
  	}
  });
  ```

- `@block65/logger/express`, `@block65/logger/lambda` and `logger.als` are
  gone. Put per-request values in a child logger's data or context.
- A destination is a web `WritableStream`, not a Node `Writable`. In Node,
  `Writable.toWeb(stream)` converts one.
- `Level` is an object of numbers, not an enum, so `Level[30]` no longer gives
  `"Info"`. `Level.Info` and the numeric values are unchanged.
- Event listeners receive `{ name, data }` rather than the data itself.
- A processor returns a whole log, and its type no longer accepts a partial
  one.
- `createCliTransformer()` and `cliTransformer()` take `{ color, timestamps }`,
  and colour is off unless `color` is true.
- `createRedactProcessor` redacts a copy and leaves the logged object as it
  was.
- Node 24 or later.
