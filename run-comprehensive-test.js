/**
 * run-comprehensive-test.js
 * 
 * Runner script for the comprehensive visual testing process
 * with enhanced visualization for LLaVA-2 integration.
 */

const { exec, execSync } = require('child_process');
const path = require('path');

// Function to run a command and return a promise
function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

// Main execution function
async function runComprehensiveTest() {
  try {
    // 1. First revert any existing bugs to get a clean state
    console.log('\n--- Reverting any existing bugs ---');
    await runCommand('node comprehensive-visual-bug.js --revert');
    
    // 2. Capture baseline screenshots in clean state
    console.log('\n--- Capturing baseline screenshots ---');
    await runCommand('npm run phase1-baseline');
    
    // 3. Apply enhanced diff visualization
    console.log('\n--- Enhancing diff visualization ---');
    await runCommand('node enhanced-visual-bug.js');
    
    // 4. Run the comparison
    console.log('\n--- Running visual comparison ---');
    await runCommand('npm run phase1');
    
    // 5. Start the report server
    console.log('\n--- Starting report server ---');
    console.log('Starting report server. Press Ctrl+C to exit when done viewing reports.');
    
    // Execute with inherit to keep the process running in the foreground
    execSync('npm run view-reports', { stdio: 'inherit' });
    
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run the test
runComprehensiveTest();
