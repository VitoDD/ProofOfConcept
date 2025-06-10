/**
 * run-phase2-openai.js
 * 
 * Runner for Phase 2 (AI-enhanced visual testing) using OpenAI models
 */

const fs = require('fs');
const path = require('path');
const { runAiVisualTestingWorkflow } = require('./src/openai/openai-ai-workflow');

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

console.log('Starting Phase 2 - AI-Enhanced Visual Testing with OpenAI...');

// Run Phase 2 workflow with OpenAI
runAiVisualTestingWorkflow({
  captureBaseline: args.includes('--baseline'),
  introduceBug: args.includes('--bug'),
  bugType: args.find(arg => arg.startsWith('--bug-type='))?.split('=')[1] || 'color',
  threshold: parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '0.1'),
  skipAiAnalysis: args.includes('--skip-ai'),
  forceContinue: args.includes('--force'),
  keepServerRunning: args.includes('--keep-server'),
  apiKey: apiKey
}).then(result => {
  if (result.success) {
    console.log('Phase 2 with OpenAI completed successfully');
    if (result.reportPath) {
      console.log(`Report available at: ${result.reportPath}`);
    }
  } else {
    console.error(`Phase 2 failed: ${result.error || result.reason || 'Unknown error'}`);
    process.exit(1);
  }
}).catch(error => {
  console.error('Error running Phase 2 workflow:', error);
  process.exit(1);
});
