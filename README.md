# @block65/logger

A structured logger for Block65 projects. The main entry point uses only web
streams, so it works in Cloudflare Workers. `@block65/logger/node` adds
`createLogger()`, which writes to stdout in a format that suits the environment
(CloudWatch, Cloud Logging, a terminal, or JSON lines).

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
});

logger.info({ requestId: "r_1" }, "slow request took %dms", 1200);
await logger.flush();
```

The package ships TypeScript source, so use it through a bundler or a
TypeScript-aware runtime.
