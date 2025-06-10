/**
 * ai-client.js
 * 
 * Client for accessing AI models in Phase 3 workflow.
 * This file serves as a wrapper around the specific AI implementation.
 */

const { 
  generateText, 
  analyzeImage, 
  analyzeMultipleImages, 
  checkOllamaStatus 
} = require('../phase2/ollama-client');

// Re-export functions with the same interface
module.exports = {
  generateText,
  analyzeImage,
  analyzeMultipleImages,
  checkAiAvailability: checkOllamaStatus
};
