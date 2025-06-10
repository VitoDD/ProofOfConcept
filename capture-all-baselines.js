/**
 * capture-all-baselines.js
 * 
 * A script to capture all baseline screenshots for the test application.
 */

const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

// Ensure the server is running
async function ensureServerRunning() {
  try {
    console.log('Checking if server is running...');
    
    try {
      const response = await fetch('http://localhost:3000/api/status');
      if (response.ok) {
        console.log('Server is already running.');
        return;
      }
    } catch (error) {
      // Server is not running, start it
      console.log('Starting server...');
      execSync('node start-server.js', { stdio: 'inherit' });
      
      // Wait for the server to start
      console.log('Waiting for server to start...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error(`Error checking/starting server: ${error.message}`);
    process.exit(1);
  }
}

// Create necessary directories
async function ensureDirectories() {
  console.log('Creating necessary directories...');
  const dirs = [
    path.join(__dirname, 'screenshots'),
    path.join(__dirname, 'screenshots', 'baseline'),
    path.join(__dirname, 'screenshots', 'current'),
    path.join(__dirname, 'screenshots', 'diff')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}: ${error.message}`);
    }
  }
}

// Capture the baseline screenshots
async function captureBaselines() {
  console.log('Capturing baseline screenshots...');
  try {
    // Use the screenshot.js script with the --baseline flag
    execSync('node src/phase1/screenshot.js --baseline', { stdio: 'inherit' });
    console.log('Baseline screenshots captured successfully!');
  } catch (error) {
    console.error(`Error capturing baseline screenshots: ${error.message}`);
  }
}

// Main function
async function main() {
  console.log('Starting baseline screenshot capture process...');
  
  // Ensure directories exist
  await ensureDirectories();
  
  // Ensure server is running
  await ensureServerRunning();
  
  // Capture baseline screenshots
  await captureBaselines();
  
  console.log('Baseline screenshot process complete!');
}

// Run the main function
main().catch(error => {
  console.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
