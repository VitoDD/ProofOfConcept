/**
 * check-openai.js
 * 
 * Utility script to check if OpenAI API is available and configured correctly
 */

const fs = require('fs');
const path = require('path');
const { checkOpenAIStatus, setApiKey } = require('./src/openai/openai-client');

// Get command line arguments
const args = process.argv.slice(2);

// Define the OpenAI API key argument
const apiKeyArg = args.find(arg => arg.startsWith('--api-key='));
let apiKey = null;

// Extract API key if provided
if (apiKeyArg) {
  apiKey = apiKeyArg.split('=')[1];
  
  // Set environment variable for the API key
  process.env.OPENAI_API_KEY = apiKey;
  console.log('OpenAI API key set from command line argument');
} else {
  // Check if API key is in environment variable
  apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log('Using OpenAI API key from environment variable');
  } else {
    console.log('No OpenAI API key provided in arguments. Checking for file-based key...');
    
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
      console.error('\n❌ OpenAI API key not found! You can provide it in one of these ways:');
      console.error('  1. Command line argument: --api-key=your-api-key');
      console.error('  2. Environment variable: OPENAI_API_KEY=your-api-key');
      console.error('  3. .env file with OPENAI_API_KEY=your-api-key');
      process.exit(1);
    }
  }
}

// Set the API key for the OpenAI client
if (apiKey) {
  setApiKey(apiKey);
}

console.log('Checking OpenAI API connection...');

// Check OpenAI status
checkOpenAIStatus()
  .then(status => {
    if (status.available) {
      console.log('✅ OpenAI API is available and configured correctly!');
      
      if (status.availableModels?.length > 0) {
        console.log('\nYour account has access to these models:');
        const displayModels = status.availableModels.filter(model => 
          model.includes('gpt-4') || model.includes('gpt-3.5')
        ).slice(0, 10);
        
        if (displayModels.length > 0) {
          displayModels.forEach(model => console.log(`  - ${model}`));
          if (status.availableModels.length > 10) {
            console.log(`  - ... and ${status.availableModels.length - 10} more`);
          }
        } else {
          console.log('  (No GPT models found in the list)');
        }
      }
      
      console.log('\nThe OpenAI integration will use these models:');
      console.log('  - Text analysis: gpt-4o-mini');
      console.log('  - Visual analysis: gpt-4o');
      
      console.log('\nYou can now run the OpenAI commands:');
      console.log('  npm run phase1-openai');
      console.log('  npm run phase2-openai');
      console.log('  npm run phase3-openai');
      console.log('  npm run phase4-openai');
      console.log('  npm run run-all-openai');
    } else {
      console.error(`❌ OpenAI API connection failed: ${status.error}`);
      console.error('\nPlease check:');
      console.error('  1. Your API key is correct');
      console.error('  2. Your account has sufficient credits');
      console.error('  3. You have access to the required models (gpt-4o-mini and gpt-4o)');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error checking OpenAI status:', error.message);
    process.exit(1);
  });
