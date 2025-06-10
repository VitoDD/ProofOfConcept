/**
 * openai-client.js
 * 
 * Client for interacting with the OpenAI API to access cloud-based AI models.
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Get API key from environment variables (should not be hardcoded in files)
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI API endpoint
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1';

// Model mapping
const MODEL_MAPPING = {
  'text': 'gpt-4o-mini', // Text model - can be configured
  'vision': 'gpt-4o'     // Vision model - can be configured
};

/**
 * Sets the API key for OpenAI
 * 
 * @param {string} apiKey - OpenAI API key
 */
function setApiKey(apiKey) {
  OPENAI_API_KEY = apiKey;
  logger.info('OpenAI API key has been set');
}

/**
 * Fetches with timeout functionality
 */
async function fetchWithTimeout(url, options, timeout = 60000) {
  const controller = new AbortController();
  const signal = controller.signal;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Generates a text completion using OpenAI
 * 
 * @param {string} prompt - Prompt to send to the model
 * @param {string} model - Model identifier (optional, uses mapping)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<string>} - Generated text
 */
async function generateText(prompt, model = 'text', options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not set. Please set it via environment variable OPENAI_API_KEY.');
  }

  const defaultOptions = {
    temperature: 0.7,
    max_tokens: 1000
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  const actualModel = MODEL_MAPPING[model] || model;
  
  logger.debug(`Generating text with model: ${actualModel}`);
  logger.debug(`Prompt: ${prompt.substring(0, 100)}...`);
  
  try {
    const response = await fetchWithTimeout(
      `${OPENAI_API_ENDPOINT}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { role: 'system', content: 'You are a helpful assistant specializing in visual testing and UI analysis.' },
            { role: 'user', content: prompt }
          ],
          temperature: requestOptions.temperature,
          max_tokens: requestOptions.max_tokens
        })
      },
      120000 // 2 minute timeout
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response content found in OpenAI API response');
    }
    
    const generatedText = data.choices[0].message.content;
    logger.debug(`Generated ${generatedText.length} characters`);
    return generatedText;
  } catch (error) {
    logger.error(`Error generating text: ${error.message}`);
    throw error;
  }
}

/**
 * Analyzes an image using GPT-4 Vision through OpenAI
 * 
 * @param {string} imagePath - Path to the image file
 * @param {string} prompt - Prompt to send with the image
 * @param {string} model - Model identifier (optional, uses mapping)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<string>} - Generated text analysis
 */
async function analyzeImage(imagePath, prompt, model = 'vision', options = {}) {
  // Reuse the multiple images function with a single image
  return analyzeMultipleImages([imagePath], prompt, model, options);
}

/**
 * Converts an image to base64 with MIME type detection
 * 
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} - Base64 encoded image with MIME type
 */
async function imageToBase64WithMime(imagePath) {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine MIME type based on file extension
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/png'; // Default
    
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.png') {
      mimeType = 'image/png';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    }
    
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    logger.error(`Error converting image to base64: ${error.message}`);
    throw error;
  }
}

/**
 * Analyzes multiple images using GPT-4 Vision through OpenAI
 * 
 * @param {Array<string>} imagePaths - Array of paths to image files
 * @param {string} prompt - Prompt to send with the images
 * @param {string} model - Model identifier (optional, uses mapping)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<string>} - Generated text analysis
 */
async function analyzeMultipleImages(imagePaths, prompt, model = 'vision', options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not set. Please set it via environment variable OPENAI_API_KEY.');
  }
  
  const defaultOptions = {
    temperature: 0.2,
    max_tokens: 1500,
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  const actualModel = MODEL_MAPPING[model] || model;
  
  logger.debug(`Analyzing ${imagePaths.length} images with model: ${actualModel}`);
  logger.debug(`Image paths: ${imagePaths.join(', ')}`);
  logger.debug(`Prompt: ${prompt}`);
  
  try {
    // Validate all image files exist and convert to base64
    const imageContents = [];
    for (const imagePath of imagePaths) {
      try {
        await fs.access(imagePath);
        const base64Image = await imageToBase64WithMime(imagePath);
        imageContents.push(base64Image);
      } catch (fileError) {
        logger.error(`Image file not found: ${imagePath}`);
        return `Error: Image file not found: ${imagePath}`;
      }
    }
    
    // Build content array with text and images
    let content = [];
    
    // Add initial prompt text
    content.push({ type: 'text', text: prompt });
    
    // Add each image as a separate content item
    for (const [index, base64Image] of imageContents.entries()) {
      let imageDescription = '';
      
      // Add descriptive labels for multiple images
      if (imagePaths.length > 1) {
        if (index === 0) imageDescription = 'Baseline image';
        else if (index === 1) imageDescription = 'Current image';
        else if (index === 2) imageDescription = 'Difference map';
      }
      
      content.push({
        type: 'image_url',
        image_url: {
          url: base64Image,
          detail: 'high'
        }
      });
      
      // Add a label after each image if we have multiple
      if (imagePaths.length > 1 && imageDescription) {
        content.push({ 
          type: 'text', 
          text: `[${imageDescription}]` 
        });
      }
    }
    
    // Make the API request with shorter timeout for CI environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const timeout = isCI ? 120000 : 300000; // 2 minutes in CI, 5 minutes locally
    
    const response = await fetchWithTimeout(
      `${OPENAI_API_ENDPOINT}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { 
              role: 'system', 
              content: 'You are a visual testing expert specializing in detecting UI bugs and visual regressions. Analyze the provided images carefully and provide detailed, accurate assessments.'
            },
            { 
              role: 'user', 
              content: content 
            }
          ],
          temperature: requestOptions.temperature,
          max_tokens: requestOptions.max_tokens
        })
      },
      timeout
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
    }
    
    // Handle the response
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response content found in OpenAI API response');
    }
    
    const generatedAnalysis = data.choices[0].message.content;
    logger.debug(`Generated analysis of ${generatedAnalysis.length} characters`);
    return generatedAnalysis;
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error('Multi-image analysis request timed out');
      return 'Error: Multi-image analysis timed out. The request may be too complex or the server might be overloaded.';
    }
    
    logger.error(`Error analyzing multiple images: ${error.message}`);
    return `Error analyzing multiple images: ${error.message}`;
  }
}

/**
 * Checks if OpenAI API is available with the provided key
 * 
 * @returns {Promise<Object>} - Information about OpenAI API availability
 */
async function checkOpenAIStatus() {
  logger.debug('Checking OpenAI API status');
  
  if (!OPENAI_API_KEY) {
    return {
      available: false,
      error: 'OpenAI API key is not set. Please set it via environment variable OPENAI_API_KEY.'
    };
  }
  
  try {
    // Make a simple models list request to check API access
    const response = await fetch(`${OPENAI_API_ENDPOINT}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      return {
        available: false,
        error: `OpenAI API returned status ${response.status}: ${errorData}`
      };
    }
    
    const data = await response.json();
    const availableModels = data.data || [];
    
    // Check if required models are available
    const requiredModels = [MODEL_MAPPING.text, MODEL_MAPPING.vision];
    const modelNames = availableModels.map(m => m.id);
    
    // For OpenAI, we only need to verify API access, not specific models
    // since model access is determined by the account permissions
    
    return {
      available: true,
      availableModels: modelNames,
      allModelsAvailable: true,
      requiredModels
    };
  } catch (error) {
    logger.error(`Error checking OpenAI status: ${error.message}`);
    
    return {
      available: false,
      error: error.message
    };
  }
}

// Export functions
module.exports = {
  generateText,
  analyzeImage,
  analyzeMultipleImages,
  checkOpenAIStatus,
  setApiKey,
  imageToBase64WithMime
};
