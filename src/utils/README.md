# Utility Modules

This directory contains utility modules that are used throughout the project.

## Modules

### Config (`config.js`)

Handles loading and accessing configuration from the `config.json` file.

Functions:
- `loadConfig(configPath)`: Loads configuration from a JSON file
- `getConfig(key, defaultValue, config)`: Gets a specific configuration value using dot notation

### Logger (`logger.js`)

Provides logging functionality with timestamps and severity levels.

Functions:
- `setLogLevel(level)`: Sets the current log level
- `enableFileLogging(filename)`: Enables logging to file
- `disableFileLogging()`: Disables logging to file
- `log(message, level)`: Logs a message with the specified level
- `debug(message)`: Logs a debug message
- `info(message)`: Logs an info message
- `warn(message)`: Logs a warning message
- `error(message)`: Logs an error message

## Usage Examples

### Config

```javascript
const { getConfig } = require('../utils/config');

// Get server port (default to 3000 if not found)
const port = getConfig('server.port', 3000);

// Get screenshot directory
const screenshotDir = getConfig('screenshots.directory', './screenshots');
```

### Logger

```javascript
const logger = require('../utils/logger');

// Set log level
logger.setLogLevel('DEBUG');

// Enable file logging
logger.enableFileLogging('app.log');

// Log messages
logger.debug('Debugging information');
logger.info('Information message');
logger.warn('Warning message');
logger.error('Error message');

// Disable file logging
logger.disableFileLogging();
```
