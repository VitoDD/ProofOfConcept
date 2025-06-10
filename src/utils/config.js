/**
 * config.js
 * 
 * Utility for loading and accessing configuration.
 */

const fs = require('fs');
const path = require('path');

// Default configuration path
const CONFIG_PATH = path.join(__dirname, '../../config.json');

/**
 * Loads configuration from a JSON file
 * 
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} - Loaded configuration
 */
function loadConfig(configPath = CONFIG_PATH) {
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`Error loading configuration from ${configPath}:`, error.message);
    return {};
  }
}

/**
 * Gets a specific configuration value
 * 
 * @param {string} key - Dot-notation path to the configuration value
 * @param {*} defaultValue - Default value to return if not found
 * @param {Object} config - Configuration object (loaded from file if not provided)
 * @returns {*} - Configuration value or default value
 */
function getConfig(key, defaultValue = null, config = null) {
  // Load config if not provided
  const configData = config || loadConfig();
  
  // Split key by dots
  const keys = key.split('.');
  
  // Traverse the config object
  let value = configData;
  for (const k of keys) {
    if (value === undefined || value === null || !Object.prototype.hasOwnProperty.call(value, k)) {
      return defaultValue;
    }
    value = value[k];
  }
  
  return value;
}

// Export functions
module.exports = {
  loadConfig,
  getConfig
};
