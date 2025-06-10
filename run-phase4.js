/**
 * Phase 4 Runner
 * 
 * This script serves as a simplified entry point for running Phase 4 (Self-Healing Implementation)
 * It delegates to the main Phase 4 workflow in src/phase4/self-healing-workflow.js
 */

const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);

// Add path to workflow file
const workflowPath = path.join(__dirname, 'src', 'phase4', 'self-healing-workflow.js');

console.log(`Running Phase 4: Self-Healing Implementation`);
console.log('-'.repeat(40));

// Check if Ollama is running first (unless --skip-ai is provided)
if (args.includes('--skip-ai')) {
  runWorkflow(args);
} else {
  checkOllamaAvailability()
    .then(isAvailable => {
      if (!isAvailable) {
        console.warn('\n⚠️ Ollama is not available. Adding --skip-ai flag.');
        args.push('--skip-ai');
      }
      runWorkflow(args);
    })
    .catch(error => {
      console.error('❌ Error checking Ollama availability:', error.message);
      console.log('Proceeding with --skip-ai flag...');
      args.push('--skip-ai');
      runWorkflow(args);
    });
}

// Run the Phase 4 workflow
function runWorkflow(args) {
  // Spawn the Phase 4 workflow process
  const childProcess = spawn('node', [workflowPath, ...args], {
    stdio: 'inherit',
    shell: true
  });

  // Handle process exit
  childProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Phase 4 completed successfully!');
      console.log('Reports are available in the reports directory.');
    } else {
      console.error(`\n❌ Phase 4 failed with code ${code}`);
    }
    process.exit(code);
  });

  // Handle errors
  childProcess.on('error', (err) => {
    console.error(`❌ Failed to start Phase 4 workflow: ${err.message}`);
    process.exit(1);
  });
}

// Check if Ollama is running
function checkOllamaAvailability() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            console.log('✅ Ollama is running');
            resolve(true);
          } else {
            console.warn('⚠️ Ollama returned unexpected status:', res.statusCode);
            resolve(false);
          }
        } catch (error) {
          console.warn('⚠️ Error parsing Ollama response:', error.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      console.warn('⚠️ Ollama is not running');
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.warn('⚠️ Connection to Ollama timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}
