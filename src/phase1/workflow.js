/**
 * workflow.js
 * 
 * Main script for running the visual testing workflow.
 * This combines screenshot capture, comparison, and reporting.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { 
  captureBaselineScreenshots, 
  captureCurrentScreenshots 
} = require('./screenshot');
const { 
  compareAllScreenshots 
} = require('./compare');
const { 
  introduceVisualBug, 
  revertVisualBugs 
} = require('./create-visual-bug');

// Report directory
const REPORTS_DIR = path.join(__dirname, '../../reports');

/**
 * Ensures the server is running
 * 
 * @returns {Promise<object>} - Server process information
 */
async function ensureServerRunning() {
  return new Promise((resolve, reject) => {
    // Try to access the server
    const http = require('http');
    
    const req = http.get('http://localhost:3000/api/status', (res) => {
      // Server is already running
      if (res.statusCode === 200) {
        resolve({ alreadyRunning: true });
      } else {
        // Status endpoint is not available, start server
        startServer().then(resolve).catch(reject);
      }
    });
    
    req.on('error', () => {
      // Server is not running, start it
      startServer().then(resolve).catch(reject);
    });
    
    req.end();
  });
}

/**
 * Starts the Express server
 * 
 * @returns {Promise<object>} - Server process information
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting server...');
    
    const serverPath = path.join(__dirname, '../server.js');
    const server = spawn('node', [serverPath], {
      detached: true,
      stdio: 'inherit'
    });
    
    // Check if server started successfully
    server.on('error', (err) => {
      reject(err);
    });
    
    // Wait for server to start
    setTimeout(() => {
      resolve({ 
        pid: server.pid,
        alreadyRunning: false
      });
    }, 3000);
  });
}

/**
 * Generates an HTML report from comparison results
 * 
 * @param {Array} results - Comparison results
 * @returns {Promise<string>} - Path to the HTML report
 */
async function generateHtmlReport(results) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportPath = path.join(REPORTS_DIR, `visual-test-report-${timestamp}.html`);
  
  // Get the current timestamped folders
  const currentDir = path.dirname(results[0]?.currentImagePath || '');
  const diffDir = path.dirname(results[0]?.diffImagePath || '');
  
  // Create basic HTML report
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Testing Report - ${timestamp}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #4a6cf7;
    }
    .report-header {
      border-bottom: 1px solid #ddd;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .summary {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    .comparison {
      margin-bottom: 40px;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .images {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 20px;
    }
    .image-container {
      flex: 1;
      min-width: 300px;
    }
    .image-container img {
      max-width: 100%;
      border: 1px solid #ddd;
    }
    .diff-details {
      background-color: ${results.some(r => r.diffPercentage > 0) ? '#fff8f8' : '#f8fff8'};
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .diff-high {
      color: #dc3545;
      font-weight: bold;
    }
    .diff-medium {
      color: #fd7e14;
      font-weight: bold;
    }
    .diff-low {
      color: #28a745;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Visual Testing Report</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Total comparisons: <strong>${results.length}</strong></p>
    <p>Total differences: <strong>${results.reduce((sum, r) => sum + (r.diffPixelCount || 0), 0).toLocaleString()} pixels</strong></p>
    <p>Average difference: <strong>${(results.reduce((sum, r) => sum + (r.diffPercentage || 0), 0) / results.length).toFixed(2)}%</strong></p>
    <p>Status: <strong style="color: ${results.some(r => r.diffPercentage > 1) ? '#dc3545' : '#28a745'}">
      ${results.some(r => r.diffPercentage > 1) ? 'Differences Detected' : 'No Significant Differences'}
    </strong></p>
    <p>Run time: <strong>${timestamp}</strong></p>
  </div>
  
  ${results.map(result => `
  <div class="comparison">
    <h2>Comparison: ${result.name}</h2>
    
    <div class="diff-details">
      <p>Difference: 
        <span class="${
          result.diffPercentage > 5 ? 'diff-high' : 
          result.diffPercentage > 1 ? 'diff-medium' : 
          'diff-low'
        }">
          ${result.diffPercentage.toFixed(2)}% (${(result.diffPixelCount || 0).toLocaleString()} of ${(result.totalPixels || 0).toLocaleString()} pixels)
        </span>
      </p>
    </div>
    
    <div class="images">
      <div class="image-container">
        <h3>Baseline</h3>
        <img src="../screenshots/baseline/baseline-${result.name}.png" alt="Baseline">
      </div>
      
      <div class="image-container">
        <h3>Current</h3>
        <img src="../screenshots/current/${path.basename(path.dirname(result.currentImagePath))}/current-${result.name}.png" alt="Current">
      </div>
      
      <div class="image-container">
        <h3>Differences</h3>
        <img src="../screenshots/diff/${path.basename(path.dirname(result.diffImagePath))}/diff-${result.name}.png" alt="Diff">
      </div>
    </div>
  </div>
  `).join('')}
</body>
</html>`;
  
  // Write HTML to file
  fs.writeFileSync(reportPath, html);
  
  console.log(`HTML report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Runs the complete visual testing workflow
 * 
 * @param {Object} options - Workflow options
 */
async function runVisualTestingWorkflow(options = {}) {
  const defaultOptions = {
    captureBaseline: false,
    introduceBug: false,
    bugType: 'color',
    threshold: 0.1
  };
  
  const workflowOptions = { ...defaultOptions, ...options };
  
  try {
    // Ensure server is running
    const server = await ensureServerRunning();
    console.log('Server is running');
    
    // Variables to store directories for the run
    let baselineResult = null;
    let currentResult = null;
    let directories = null;
    
    // Capture baseline screenshots if needed
    if (workflowOptions.captureBaseline) {
      console.log('\n--- Capturing Baseline Screenshots ---');
      baselineResult = await captureBaselineScreenshots();
    }
    
    // Introduce visual bug if requested
    if (workflowOptions.introduceBug) {
      console.log('\n--- Introducing Visual Bug ---');
      await introduceVisualBug(workflowOptions.bugType);
    }
    
    // Capture current screenshots
    console.log('\n--- Capturing Current Screenshots ---');
    currentResult = await captureCurrentScreenshots();
    
    // Determine directories to use for comparison
    if (baselineResult && currentResult) {
      directories = {
        baselineDir: baselineResult.baselineDir,
        currentDir: currentResult.currentDir,
        diffDir: currentResult.diffDir
      };
    } else if (currentResult) {
      directories = {
        currentDir: currentResult.currentDir,
        diffDir: currentResult.diffDir
      };
    }
    
    // Compare screenshots
    console.log('\n--- Comparing Screenshots ---');
    const results = await compareAllScreenshots(workflowOptions.threshold, directories);
    
    // Generate HTML report
    console.log('\n--- Generating Report ---');
    const reportPath = await generateHtmlReport(results);
    
    console.log('\n--- Visual Testing Workflow Complete ---');
    console.log(`Report available at: ${reportPath}`);
    
    // Stop server if we started it
    if (server && !server.alreadyRunning && server.pid) {
      process.kill(server.pid);
    }
    
    return {
      success: true,
      results,
      reportPath,
      directories
    };
  } catch (error) {
    console.error('Error in visual testing workflow:', error);
    return {
      success: false,
      error
    };
  }
}

// Export functions
module.exports = {
  runVisualTestingWorkflow,
  ensureServerRunning,
  generateHtmlReport
};

// If this script is run directly, run the workflow
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  const options = {
    captureBaseline: args.includes('--baseline'),
    introduceBug: args.includes('--bug'),
    bugType: args.find(arg => arg.startsWith('--bug-type='))?.split('=')[1] || 'color',
    threshold: parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '0.1')
  };
  
  runVisualTestingWorkflow(options);
}
