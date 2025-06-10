/**
 * logger.js
 * 
 * Utility for logging messages with timestamps and severity levels.
 */

const fs = require('fs');
const path = require('path');

// Log directory
const LOG_DIR = path.join(__dirname, '../../logs');

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level (can be changed at runtime)
let currentLogLevel = LOG_LEVELS.INFO;

// File stream for logging to file
let fileStream = null;

/**
 * Ensures the log directory exists
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Opens a log file for writing
 * 
 * @param {string} filename - Name of the log file
 * @returns {fs.WriteStream} - Write stream for the log file
 */
function openLogFile(filename = 'app.log') {
  ensureLogDir();
  
  const logPath = path.join(LOG_DIR, filename);
  
  return fs.createWriteStream(logPath, { flags: 'a' });
}

/**
 * Sets the current log level
 * 
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 */
function setLogLevel(level) {
  if (typeof level === 'string' && LOG_LEVELS[level.toUpperCase()] !== undefined) {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()];
  } else if (typeof level === 'number' && level >= 0 && level <= 3) {
    currentLogLevel = level;
  } else {
    console.error(`Invalid log level: ${level}`);
  }
}

/**
 * Enables logging to file
 * 
 * @param {string} filename - Name of the log file
 */
function enableFileLogging(filename = 'app.log') {
  fileStream = openLogFile(filename);
}

/**
 * Disables logging to file
 */
function disableFileLogging() {
  if (fileStream) {
    fileStream.end();
    fileStream = null;
  }
}

/**
 * Logs a message with the specified level
 * 
 * @param {string} message - Message to log
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 */
function log(message, level = 'INFO') {
  const levelValue = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  
  // Check if we should log based on current level
  if (levelValue < currentLogLevel) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Log to console
  if (level === 'ERROR') {
    console.error(logMessage);
  } else if (level === 'WARN') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Log to file if enabled
  if (fileStream) {
    fileStream.write(`${logMessage}\n`);
  }
}

/**
 * Logs a debug message
 * 
 * @param {string} message - Message to log
 */
function debug(message) {
  log(message, 'DEBUG');
}

/**
 * Logs an info message
 * 
 * @param {string} message - Message to log
 */
function info(message) {
  log(message, 'INFO');
}

/**
 * Logs a warning message
 * 
 * @param {string} message - Message to log
 */
function warn(message) {
  log(message, 'WARN');
}

/**
 * Logs an error message
 * 
 * @param {string} message - Message to log
 */
function error(message) {
  log(message, 'ERROR');
}

// Export functions
module.exports = {
  setLogLevel,
  enableFileLogging,
  disableFileLogging,
  log,
  debug,
  info,
  warn,
  error,
  LOG_LEVELS
};
