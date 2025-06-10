/**
 * run-phase1-openai.js
 * 
 * Runner for Phase 1 (basic visual testing) with OpenAI API key setup
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
  console.log('OpenAI API key set');
} else {
  // Check if API key is in environment variable
  apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log('Using OpenAI API key from environment variable');
  } else {
    console.log('No OpenAI API key provided. Using file-based if available.');
    
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
  }
}

// Phase 1 doesn't actually use AI, but we're setting up the key 
// for consistency across all phases and to be ready for Phase 2
console.log('Starting Phase 1 - Basic Visual Testing with OpenAI configuration...');

// Check for specific modes
const shouldCaptureBaseline = args.includes('--baseline');
const shouldIntroduceBug = args.includes('--bug');
const useStandardMode = args.includes('--standard');

// If baseline or bug flags are provided, use the standard workflow
// Otherwise, use the enhanced workflow by default
if (shouldCaptureBaseline || shouldIntroduceBug || useStandardMode) {
  // Standard workflow - just capture baseline or introduce simple bug
  console.log(`Running Phase 1 (OpenAI): Standard Visual Testing`);
  console.log('-'.repeat(40));
  
  // Add path to workflow file
  const workflowPath = path.join(__dirname, 'src', 'phase1', 'workflow.js');
  
  // If neither baseline nor bug flags are provided, just run the comparison
  const effectiveArgs = args.length > 0 ? args : [];
  
  // Spawn the Phase 1 workflow process with OpenAI environment variables
  const childProcess = spawn('node', [workflowPath, ...effectiveArgs], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      OPENAI_API_KEY: apiKey
    }
  });
  
  // Handle process exit
  childProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Phase 1 (OpenAI) completed successfully!');
      console.log('Reports are available in the reports directory.');
    } else {
      console.error(`\n❌ Phase 1 (OpenAI) failed with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle errors
  childProcess.on('error', (err) => {
    console.error(`❌ Failed to start Phase 1 workflow: ${err.message}`);
    process.exit(1);
  });
} else {
  // Enhanced workflow - run the comprehensive visual testing
  console.log(`Running Phase 1 (OpenAI): Enhanced Visual Testing with Comprehensive Bugs`);
  console.log('-'.repeat(60));
  
  // Spawn the enhanced Phase 1 workflow process
  const enhancedPath = path.join(__dirname, 'run-enhanced-phase1.js');
  
  const childProcess = spawn('node', [enhancedPath, ...args], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      OPENAI_API_KEY: apiKey
    }
  });
  
  // Handle process exit
  childProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Enhanced Phase 1 (OpenAI) completed successfully!');
      console.log('Reports are available in the reports directory.');
      console.log('To view the reports, run: npm run view-reports');
    } else {
      console.error(`\n❌ Enhanced Phase 1 (OpenAI) failed with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle errors
  childProcess.on('error', (err) => {
    console.error(`❌ Failed to start Enhanced Phase 1 workflow: ${err.message}`);
    process.exit(1);
  });
}
