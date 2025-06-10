/**
 * ollama-client.js
 * 
 * Client for interacting with the Ollama API to access local AI models.
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Get Ollama endpoint from config
const OLLAMA_ENDPOINT = getConfig('ai.ollamaEndpoint', 'http://localhost:11434/api');

// Define a reusable function for fetch with timeout
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
 * Generates a text completion using Ollama
 * 
 * @param {string} prompt - Prompt to send to the model
 * @param {string} model - Model to use (default: llama3.2)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<string>} - Generated text
 */
async function generateText(prompt, model = 'llama3.2', options = {}) {
  const defaultOptions = {
    temperature: 0.7,
    max_tokens: 1000,
    stream: false
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  
  logger.debug(`Generating text with model: ${model}`);
  logger.debug(`Prompt: ${prompt.substring(0, 100)}...`);
  
  try {
    const response = await fetchWithTimeout(
      `${OLLAMA_ENDPOINT}/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          options: {
            temperature: requestOptions.temperature,
            num_predict: requestOptions.max_tokens
          },
          stream: requestOptions.stream
        })
      },
      120000 // 2 minute timeout
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorData}`);
    }
    
    // Get the response as text first
    const responseText = await response.text();
    
    // Check for streaming format (multiple JSON objects)
    if (responseText.includes('"done":false') || responseText.includes('"done":true')) {
      // Handle streaming format - collect all responses
      let fullResponse = '';
      
      try {
        // Split by newlines in case of streaming response
        const jsonLines = responseText.trim().split('\n');
        
        // Process each line as a separate JSON object
        for (const line of jsonLines) {
          if (line.trim()) {
            try {
              const jsonBlock = JSON.parse(line.trim());
              if (jsonBlock.response) {
                fullResponse += jsonBlock.response;
              }
            } catch (parseError) {
              // Continue processing other lines
            }
          }
        }
        
        // If we successfully parsed at least one response
        if (fullResponse) {
          logger.debug(`Generated ${fullResponse.length} characters`);
          return fullResponse;
        }
      } catch (streamParseError) {
        logger.error(`Error parsing streaming response: ${streamParseError.message}`);
        // Fall through to standard parsing
      }
    }
    
    // Try standard JSON parsing as fallback
    try {
      const data = JSON.parse(responseText);
      
      if (!data.response) {
        throw new Error('No response field found in Ollama API response');
      }
      
      logger.debug(`Generated ${data.response.length} characters`);
      return data.response;
    } catch (jsonError) {
      logger.error(`Error parsing JSON response: ${jsonError.message}`);
      throw new Error(`Failed to parse Ollama response: ${jsonError.message}`);
    }
  } catch (error) {
    logger.error(`Error generating text: ${error.message}`);
    throw error;
  }
}

/**
 * Analyzes an image using a multimodal model through Ollama
 * 
 * @param {string} imagePath - Path to the image file
 * @param {string} prompt - Prompt to send with the image
 * @param {string} model - Model to use (default: llava)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<string>} - Generated text analysis
 */
async function analyzeImage(imagePath, prompt, model = 'llava', options = {}) {
  // Reuse the multiple images function with a single image
  return analyzeMultipleImages([imagePath], prompt, model, options);
}
/**
 * Analyzes multiple images using a multimodal model through Ollama
 * 
 * @param {Array<string>} imagePaths - Array of paths to image files
 * @param {string} prompt - Prompt to send with the images
 * @param {string} model - Model to use (default: llava)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<string>} - Generated text analysis
 */
async function analyzeMultipleImages(imagePaths, prompt, model = 'llava', options = {}) {
  const defaultOptions = {
    temperature: 0.2,
    max_tokens: 1500,  // Increased token limit for multiple image analysis
    stream: false
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  
  logger.debug(`Analyzing ${imagePaths.length} images with model: ${model}`);
  logger.debug(`Image paths: ${imagePaths.join(', ')}`);
  logger.debug(`Prompt: ${prompt}`);
  
  try {
    // Validate all image files exist
    const imageBuffers = [];
    for (const imagePath of imagePaths) {
      try {
        await fs.access(imagePath);
        const imageBuffer = await fs.readFile(imagePath);
        imageBuffers.push(imageBuffer.toString('base64'));
      } catch (fileError) {
        logger.error(`Image file not found: ${imagePath}`);
        return `Error: Image file not found: ${imagePath}`;
      }
    }
    
    // Build API request body
    const requestBody = {
      model,
      prompt,
      images: imageBuffers,
      options: {
        temperature: requestOptions.temperature,
        num_predict: requestOptions.max_tokens
      },
      stream: requestOptions.stream
    };
    
    // Log request structure (without the image data for brevity)
    logger.debug(`Request structure: ${JSON.stringify({
      ...requestBody,
      images: [`<${imageBuffers.length} base64-encoded images>`]
    })}`);
    
    // Use fetch with timeout (with increased timeout for image processing)
    const response = await fetchWithTimeout(
      `${OLLAMA_ENDPOINT}/generate`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      },
      600000 // 10 minute timeout for multi-image processing
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorData}`);
    }
    
    // Handle the response
    const responseText = await response.text();
    logger.debug(`Raw response length: ${responseText.length} characters`);
    
    // For non-streaming responses
    if (!requestOptions.stream) {
      try {
        // Try to parse as a single JSON object
        const data = JSON.parse(responseText);
        
        if (data.response) {
          logger.debug(`Generated analysis of ${data.response.length} characters`);
          return data.response;
        } else {
          logger.warn('No response field found in Ollama API non-streaming response');
          
          // Look for 'content' field as fallback (sometimes occurs in newer API versions)
          if (data.content) {
            return data.content;
          }
          
          return `Error: Unexpected API response format. Could not find 'response' field.`;
        }
      } catch (jsonError) {
        logger.error(`Error parsing JSON response: ${jsonError.message}`);
        
        // Try to parse it as a JSONL format (in case streaming was forced despite our setting)
        try {
          let fullResponse = '';
          const jsonLines = responseText.trim().split('\n');
          
          for (const line of jsonLines) {
            if (line.trim()) {
              const jsonBlock = JSON.parse(line.trim());
              if (jsonBlock.response) {
                fullResponse += jsonBlock.response;
              }
            }
          }
          
          if (fullResponse) {
            logger.info('Successfully parsed response as JSONL stream format');
            return fullResponse;
          }
        } catch (streamParseError) {
          logger.error(`Error parsing as stream: ${streamParseError.message}`);
        }
        
        // If all parsing fails, return a clear error
        return `Error parsing Ollama response: Response format not recognized. Raw data length: ${responseText.length} characters`;
      }
    } 
    // Handle streaming responses (if stream:true was explicitly requested)
    else {
      // Similar streaming handling as in analyzeImage...
      let fullResponse = '';
      
      try {
        // Split by newlines for streaming response
        const jsonLines = responseText.trim().split('\n');
        let linesProcessed = 0;
        
        // Process each line as a separate JSON object
        for (const line of jsonLines) {
          if (line.trim()) {
            try {
              const jsonBlock = JSON.parse(line.trim());
              if (jsonBlock.response) {
                fullResponse += jsonBlock.response;
                linesProcessed++;
              }
            } catch (parseError) {
              logger.warn(`Couldn't parse JSON line: ${line.substring(0, 50)}...`);
            }
          }
        }
        
        logger.debug(`Processed ${linesProcessed} JSON lines from streaming response`);
        
        if (fullResponse) {
          logger.debug(`Generated analysis of ${fullResponse.length} characters from streaming response`);
          return fullResponse;
        } else {
          return `Error: Could not extract response content from streaming format.`;
        }
      } catch (streamParseError) {
        logger.error(`Error parsing streaming response: ${streamParseError.message}`);
        return `Error parsing streaming response: ${streamParseError.message}`;
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error(`Multi-image analysis request timed out after 10 minutes`);
      return `Error: Multi-image analysis timed out after 10 minutes. The model may be too large for your hardware or the server might be overloaded.`;
    }
    
    logger.error(`Error analyzing multiple images: ${error.message}`);
    return `Error analyzing multiple images: ${error.message}`;
  }
}

/**
 * Checks if Ollama is available and the required models are loaded
 * 
 * @param {Array<string>} requiredModels - List of required models
 * @returns {Promise<Object>} - Information about Ollama availability and models
 */
async function checkOllamaStatus(requiredModels = ['llama3.2', 'llava']) {
  logger.debug('Checking Ollama status');
  
  try {
    // Check Ollama API availability by fetching list of models
    const response = await fetch(`${OLLAMA_ENDPOINT}/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return {
        available: false,
        error: `Ollama API returned status ${response.status}`
      };
    }
    
    // Get response as text first to debug any parsing issues
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      logger.error(`Error parsing model list: ${jsonError.message}`);
      logger.debug(`Response text: ${responseText}`);
      
      return {
        available: true,
        error: `Error parsing model list: ${jsonError.message}`,
        rawResponse: responseText,
        allModelsAvailable: false
      };
    }
    
    const availableModels = data.models || [];
    
    logger.debug(`Ollama available with ${availableModels.length} models`);
    if (availableModels.length > 0) {
      logger.debug(`Available models: ${availableModels.map(m => m.name).join(', ')}`);
    }
    
    // Check if required models are available with more flexible matching
    // This will match 'llama3.2' with 'llama3.2:latest' or 'llama3.2.2:latest'
    const missingModels = [];
    
    for (const requiredModel of requiredModels) {
      const modelFound = availableModels.some(m => {
        const modelName = m.name.split(':')[0]; // Remove version tag if present
        return (
          modelName === requiredModel || 
          modelName.startsWith(`${requiredModel}.`) || 
          requiredModel.startsWith(`${modelName}.`)
        );
      });
      
      if (!modelFound) {
        missingModels.push(requiredModel);
      }
    }
    
    return {
      available: true,
      availableModels: availableModels.map(m => m.name),
      missingModels,
      allModelsAvailable: missingModels.length === 0,
      requiredModels
    };
  } catch (error) {
    logger.error(`Error checking Ollama status: ${error.message}`);
    
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
  checkOllamaStatus
};
