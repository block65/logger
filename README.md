# @colacube/logger

Super basic logging module. JSON in production, pretty in dev.

## Install

```bash
yarn add @colacube/logger
```

## Example

### Logging

```javascript
import { logger } from '@colacube/logger';

// General info notices
logger.info('Something informative');

// Warnings
logger.warn('Something bad, but not that bad');

// NOTE: Logging nothing but the error object is highly
// recommended. If you need more data see @colacube/errors 
logger.error(err);

// NOTE: Don't do this: use debug() for real debug debugging.
// @deprecated
logger.debug('Something is seriously wrong!');

```

## License

MIT - See [LICENSE](LICENSE.md)
