/**
 * start-server.js
 * 
 * A utility script to start the test server independently 
 * before running the visual testing workflow.
 */

const { startServer } = require('./src/server');
const { getConfig } = require('./src/utils/config');
const logger = require('./src/utils/logger');

// Enable file logging
logger.enableFileLogging('server.log');

/**
 * Start the server on the configured port
 */
async function main() {
  const port = getConfig('server.port', 3000);
  const host = getConfig('server.host', 'localhost');
  
  logger.info(`Starting server on ${host}:${port}...`);
  
  try {
    const server = await startServer(port, host);
    
    logger.info(`Server started successfully on http://${host}:${port}`);
    logger.info('Press Ctrl+C to stop the server');
    
    // Store server in global object for access from other modules
    global.serverProcess = server;
    
    // Handle process termination
    process.on('SIGINT', () => {
      logger.info('Shutting down server...');
      server.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
