/**
 * Phase 3 Runner (Without AI)
 * 
 * This script serves as an entry point for running Phase 3 without AI features
 * It delegates to the main Phase 3 workflow with the --skip-ai flag
 */

const path = require('path');
const { spawn } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);

// Add path to workflow file and --skip-ai flag
const workflowPath = path.join(__dirname, 'src', 'phase3', 'phase3-workflow.js');
const allArgs = [workflowPath, '--skip-ai', ...args];

// Spawn the Phase 3 workflow process with the skip-ai flag
const childProcess = spawn('node', allArgs, {
  stdio: 'inherit',
  shell: true
});

// Handle process exit
childProcess.on('close', (code) => {
  process.exit(code);
});

// Handle errors
childProcess.on('error', (err) => {
  console.error(`❌ Failed to start Phase 3 workflow: ${err.message}`);
  process.exit(1);
});
