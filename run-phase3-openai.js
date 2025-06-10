/**
 * run-phase3-openai.js
 * 
 * Runner for Phase 3 (Advanced Analysis) using OpenAI models
 */

const fs = require('fs');
const path = require('path');
const { setApiKey } = require('./src/openai/openai-client');

// CRITICAL: Override AI functions BEFORE loading any workflows
// This ensures the overrides are in place when the workflow modules are loaded

console.log('Setting up OpenAI overrides for Phase 3...');

// First, override the Ollama client to redirect to OpenAI
const ollamaClient = require('./src/phase2/ollama-client');
const openaiClient = require('./src/openai/openai-client');

// Override the checkOllamaStatus function to use OpenAI instead
console.log('Overriding Ollama client to use OpenAI...');
ollamaClient.checkOllamaStatus = async () => {
  console.log('Redirecting Ollama check to OpenAI...');
  try {
    const status = await openaiClient.checkOpenAIStatus();
    return {
      available: status.available,
      allModelsAvailable: status.available,
      availableModels: status.available ? ['gpt-4o', 'gpt-4o-mini'] : [],
      missingModels: status.available ? [] : ['gpt-4o', 'gpt-4o-mini'],
      error: status.error
    };
  } catch (error) {
    return {
      available: false,
      allModelsAvailable: false,
      availableModels: [],
      missingModels: ['gpt-4o', 'gpt-4o-mini'],
      error: error.message
    };
  }
};

// Override the AI workflow functions to use OpenAI
const originalAiWorkflow = require('./src/phase2/ai-workflow');
const openaiAiWorkflow = require('./src/openai/openai-ai-workflow');

// Override the main workflow function
console.log('Overriding AI workflow functions...');
originalAiWorkflow.runAiVisualTestingWorkflow = openaiAiWorkflow.runAiVisualTestingWorkflow;
originalAiWorkflow.checkAiAvailability = openaiAiWorkflow.checkAiAvailability;

// Override the visual analyzer to use OpenAI
const originalVisualAnalyzer = require('./src/phase2/visual-analyzer');
const openaiVisualAnalyzer = require('./src/openai/openai-visual-analyzer');

// Replace visual analyzer functions
console.log('Overriding visual analyzer functions...');
originalVisualAnalyzer.analyzeVisualDifference = openaiVisualAnalyzer.analyzeVisualDifference;
originalVisualAnalyzer.isFalsePositive = openaiVisualAnalyzer.isFalsePositive;

// Override the AI client to use OpenAI
const originalAiClient = require('./src/phase3/ai-client');

// Replace the original AI client functions with OpenAI equivalents
console.log('Overriding AI client functions...');
originalAiClient.generateText = (prompt, model, options) => {
  console.log('Using OpenAI for text generation...');
  return openaiClient.generateText(prompt, 'text', options);
};

originalAiClient.analyzeImage = (imagePath, prompt, model, options) => {
  console.log('Using OpenAI for image analysis...');
  return openaiClient.analyzeImage(imagePath, prompt, 'vision', options);
};

originalAiClient.analyzeMultipleImages = (imagePaths, prompt, model, options) => {
  console.log('Using OpenAI for multi-image analysis...');
  return openaiClient.analyzeMultipleImages(imagePaths, prompt, 'vision', options);
};

originalAiClient.checkAiAvailability = () => {
  console.log('Checking OpenAI availability...');
  return openaiClient.checkOpenAIStatus();
};

// Now load the Phase 3 workflow AFTER overrides are in place
console.log('Loading Phase 3 workflow with OpenAI overrides...');
const phase3Workflow = require('./src/phase3/phase3-workflow');

// Get command line arguments
const args = process.argv.slice(2);

// Define the OpenAI API key argument
const apiKeyArg = args.find(arg => arg.startsWith('--api-key='));
let apiKey = null;

// Extract API key if provided
if (apiKeyArg) {
  apiKey = apiKeyArg.split('=')[1];
  
  // Remove the API key argument from args
  const apiKeyIndex = args.indexOf(apiKeyArg);
  if (apiKeyIndex !== -1) {
    args.splice(apiKeyIndex, 1);
  }
  
  // Set environment variable for the API key
  process.env.OPENAI_API_KEY = apiKey;
  console.log('OpenAI API key set from command line argument');
} else {
  // Check if API key is in environment variable
  apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log('Using OpenAI API key from environment variable');
  } else {
    console.log('No OpenAI API key provided. Checking for file-based key...');
    
    // Try to load from .env file if it exists
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/OPENAI_API_KEY=([^\s]+)/);
        if (match && match[1]) {
          apiKey = match[1];
          process.env.OPENAI_API_KEY = apiKey;
          console.log('Loaded OpenAI API key from .env file');
        }
      }
    } catch (error) {
      console.error('Error loading .env file:', error.message);
    }
    
    // If no key found anywhere, provide instructions
    if (!apiKey) {
      console.warn('\n⚠️ OpenAI API key not found! You can provide it in one of these ways:');
      console.warn('  1. Command line argument: --api-key=your-api-key');
      console.warn('  2. Environment variable: OPENAI_API_KEY=your-api-key');
      console.warn('  3. .env file with OPENAI_API_KEY=your-api-key');
      console.warn('\nProceeding without AI analysis...\n');
    }
  }
}

// Set the API key for the OpenAI client
if (apiKey) {
  setApiKey(apiKey);
}

// Indicate we're using OpenAI
console.log('Starting Phase 3 - Advanced Analysis with OpenAI...');

// Run Phase 3 workflow with the patched AI client
phase3Workflow.runPhase3Workflow({
  captureBaseline: args.includes('--baseline'),
  introduceBug: args.includes('--bug'),
  bugType: args.find(arg => arg.startsWith('--bug-type='))?.split('=')[1] || 'color',
  threshold: parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '0.1'),
  skipAiAnalysis: args.includes('--skip-ai'),
  forceContinue: args.includes('--force'),
  keepServerRunning: args.includes('--keep-server'),
  useOpenAI: true, // Flag to indicate we're using OpenAI
  apiKey: apiKey
}).then(result => {
  if (result.success) {
    console.log('Phase 3 with OpenAI completed successfully');
    if (result.reportPath) {
      console.log(`Report available at: ${result.reportPath}`);
    }
  } else {
    console.error(`Phase 3 failed: ${result.error || result.reason || 'Unknown error'}`);
    process.exit(1);
  }
}).catch(error => {
  console.error('Error running Phase 3 workflow:', error);
  process.exit(1);
});
