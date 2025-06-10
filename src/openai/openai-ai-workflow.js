/**
 * openai-ai-workflow.js
 * 
 * AI-enhanced visual testing workflow using OpenAI models.
 */

const path = require('path');
const fs = require('fs');
const { 
  captureBaselineScreenshots, 
  captureCurrentScreenshots 
} = require('../phase1/screenshot');
const { 
  compareAllScreenshots 
} = require('../phase1/compare');
const { 
  introduceVisualBug, 
  revertVisualBugs 
} = require('../phase1/create-visual-bug');
const {
  analyzeVisualDifference,
  isFalsePositive
} = require('./openai-visual-analyzer');
const {
  checkOpenAIStatus,
  setApiKey
} = require('./openai-client');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Enable file logging
logger.enableFileLogging('openai-visual-testing.log');

/**
 * Ensures the server is running
 * 
 * @returns {Promise<object>} - Server process information
 */
async function ensureServerRunning() {
  return new Promise((resolve, reject) => {
    // Try to access the server
    const http = require('http');
    const port = getConfig('server.port', 3000);
    const host = getConfig('server.host', 'localhost');
    
    const req = http.get(`http://${host}:${port}/api/status`, (res) => {
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
    logger.info('Starting server...');
    
    const serverPath = path.join(__dirname, '../server.js');
    const { spawn } = require('child_process');
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
 * Checks if OpenAI API is available with the configured key
 * 
 * @returns {Promise<boolean>} - Whether OpenAI API is available
 */
async function checkAiAvailability(apiKey = null) {
  logger.info('Checking OpenAI API availability...');
  
  try {
    // If an API key is provided, set it
    if (apiKey) {
      setApiKey(apiKey);
    } else {
      // Try to get from environment variable
      const envApiKey = process.env.OPENAI_API_KEY;
      if (envApiKey) {
        setApiKey(envApiKey);
      }
    }
    
    const openaiStatus = await checkOpenAIStatus();
    
    if (!openaiStatus.available) {
      logger.warn(`OpenAI API is not available: ${openaiStatus.error}`);
      return false;
    }
    
    logger.info('OpenAI API is available');
    return true;
  } catch (error) {
    logger.error(`Error checking OpenAI API availability: ${error.message}`);
    return false;
  }
}

/**
 * Generates an AI-enhanced HTML report
 * 
 * @param {Array<Object>} results - Enhanced comparison results
 * @returns {Promise<string>} - Path to the generated report
 */
async function generateAiReport(results) {
  logger.info('Generating AI-enhanced report');
  
  try {
    // Create a timestamp for the report
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportDir = path.join(process.cwd(), 'reports');
    const reportPath = path.join(reportDir, `report-openai-${timestamp}.html`);
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Prepare report data
    const reportData = {
      title: 'OpenAI Visual Testing Report',
      timestamp,
      results: results.map(result => ({
        ...result,
        // Use relative paths for report
        baselineImagePath: path.basename(result.baselineImagePath),
        currentImagePath: path.basename(result.currentImagePath),
        diffImagePath: result.diffPercentage > 0 ? path.basename(result.diffImagePath) : null
      }))
    };
    
    // Generate HTML report
    const html = generateHtmlReportContent(reportData);
    
    // Write to file
    fs.writeFileSync(reportPath, html);
    
    logger.info(`Report generated at: ${reportPath}`);
    return reportPath;
  } catch (error) {
    logger.error(`Error generating AI report: ${error.message}`);
    throw error;
  }
}

/**
 * Generates HTML content for the report
 * 
 * @param {Object} reportData - Report data
 * @returns {string} - HTML content
 */
function generateHtmlReportContent(reportData) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportData.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .report-header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .report-metadata {
      display: flex;
      justify-content: space-between;
      color: #7f8c8d;
      font-size: 0.9em;
    }
    .comparison-item {
      margin-bottom: 40px;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .comparison-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .comparison-title {
      font-size: 1.2em;
      font-weight: bold;
      margin: 0;
    }
    .comparison-status {
      padding: 5px 10px;
      border-radius: 4px;
      font-weight: bold;
    }
    .status-pass {
      background-color: #e6f7ed;
      color: #2e7d32;
    }
    .status-fail {
      background-color: #fae9e8;
      color: #c62828;
    }
    .status-warning {
      background-color: #fff8e1;
      color: #ff8f00;
    }
    .image-comparison {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    .image-container {
      flex: 1;
      min-width: 300px;
    }
    .image-container img {
      max-width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .image-caption {
      font-size: 0.9em;
      margin-top: 8px;
      color: #7f8c8d;
      text-align: center;
    }
    .ai-analysis {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
      white-space: pre-wrap;
    }
    .ai-summary {
      font-weight: bold;
      margin-bottom: 10px;
    }
    .metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 15px;
    }
    .metric {
      background-color: #e3f2fd;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 30px;
    }
    .summary-table th,
    .summary-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .summary-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .summary-table tr:hover {
      background-color: #f5f5f5;
    }
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #7f8c8d;
      font-size: 0.9em;
      text-align: center;
    }
    .ai-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background-color: #6047ff;
      color: white;
      font-size: 0.8em;
      margin-left: 8px;
    }
    .severity-HIGH {
      color: #c62828;
      font-weight: bold;
    }
    .severity-MEDIUM {
      color: #ff8f00;
      font-weight: bold;
    }
    .severity-LOW {
      color: #2e7d32;
      font-weight: bold;
    }
    .false-positive {
      color: #7f8c8d;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${reportData.title} <span class="ai-badge">OpenAI</span></h1>
    <div class="report-metadata">
      <span>Generated: ${new Date(reportData.timestamp).toLocaleString()}</span>
      <span>Total comparisons: ${reportData.results.length}</span>
    </div>
  </div>
  
  <div class="summary-section">
    <h2>Summary</h2>
    <table class="summary-table">
      <thead>
        <tr>
          <th>Screenshot</th>
          <th>Difference</th>
          <th>Severity</th>
          <th>AI Assessment</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${reportData.results.map(result => `
          <tr>
            <td>${result.name}</td>
            <td>${result.diffPercentage ? result.diffPercentage.toFixed(2) + '%' : '0.00%'}</td>
            <td class="severity-${result.aiAnalysis?.severity || 'LOW'}">${result.aiAnalysis?.severity || 'N/A'}</td>
            <td>${result.aiAnalysis?.summary || 'No differences detected'}</td>
            <td>
              <span class="comparison-status ${result.diffPercentage > 0 ? (result.aiAnalysis?.isFalsePositive ? 'status-warning' : 'status-fail') : 'status-pass'}">
                ${result.diffPercentage > 0 ? (result.aiAnalysis?.isFalsePositive ? 'FALSE POSITIVE' : 'DIFFERENCES') : 'PASS'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <h2>Detailed Results</h2>
  
  ${reportData.results.map(result => `
    <div class="comparison-item">
      <div class="comparison-header">
        <h3 class="comparison-title">${result.name}</h3>
        <span class="comparison-status ${result.diffPercentage > 0 ? (result.aiAnalysis?.isFalsePositive ? 'status-warning' : 'status-fail') : 'status-pass'}">
          ${result.diffPercentage > 0 ? (result.aiAnalysis?.isFalsePositive ? 'FALSE POSITIVE' : 'DIFFERENCES') : 'PASS'}
        </span>
      </div>
      
      <div class="metrics">
        <div class="metric">Difference: ${result.diffPercentage ? result.diffPercentage.toFixed(2) + '%' : '0.00%'}</div>
        ${result.diffPixels ? `<div class="metric">Changed pixels: ${result.diffPixels}</div>` : ''}
        ${result.aiAnalysis?.severity ? `<div class="metric">Severity: <span class="severity-${result.aiAnalysis.severity}">${result.aiAnalysis.severity}</span></div>` : ''}
        ${result.aiAnalysis?.confidence ? `<div class="metric">Confidence: ${(result.aiAnalysis.confidence * 100).toFixed(0)}%</div>` : ''}
        ${result.aiAnalysis?.changeType ? `<div class="metric">Change type: ${result.aiAnalysis.changeType}</div>` : ''}
      </div>
      
      <div class="image-comparison">
        <div class="image-container">
          <img src="${result.baselineImagePath}" alt="Baseline - ${result.name}">
          <div class="image-caption">Baseline</div>
        </div>
        <div class="image-container">
          <img src="${result.currentImagePath}" alt="Current - ${result.name}">
          <div class="image-caption">Current</div>
        </div>
        ${result.diffPercentage > 0 ? `
          <div class="image-container">
            <img src="${result.diffImagePath}" alt="Diff - ${result.name}">
            <div class="image-caption">Differences</div>
          </div>
        ` : ''}
      </div>
      
      ${result.aiAnalysis ? `
        <div class="ai-analysis">
          <div class="ai-summary">${result.aiAnalysis.isFalsePositive ? '<span class="false-positive">⚠️ Likely False Positive:</span> ' : ''}${result.aiAnalysis.summary}</div>
          ${result.aiAnalysis.description}
        </div>
      ` : ''}
    </div>
  `).join('')}
  
  <div class="report-footer">
    <p>Powered by AI-Enhanced Visual Testing with OpenAI GPT-4 Vision</p>
  </div>
</body>
</html>`;
}

/**
 * Runs the OpenAI-enhanced visual testing workflow
 * 
 * @param {Object} options - Workflow options
 */
async function runAiVisualTestingWorkflow(options = {}) {
  const defaultOptions = {
    captureBaseline: false,
    introduceBug: false,
    bugType: 'color',
    threshold: 0.1,
    skipAiAnalysis: false,
    apiKey: null
  };
  
  const workflowOptions = { ...defaultOptions, ...options };
  
  try {
    logger.info('Starting OpenAI-enhanced visual testing workflow');
    
    // Ensure server is running
    const server = await ensureServerRunning();
    logger.info('Server is running');
    
    // Check OpenAI API availability if needed
    let aiAvailable = true;
    if (!workflowOptions.skipAiAnalysis) {
      aiAvailable = await checkAiAvailability(workflowOptions.apiKey);
      
      if (!aiAvailable) {
        logger.warn('AI analysis will be skipped due to unavailable OpenAI API');
        
        // Ask user if they want to continue without AI
        if (!workflowOptions.forceContinue) {
          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise(resolve => {
            rl.question('Continue without AI analysis? (y/n) ', resolve);
          });
          
          rl.close();
          
          if (answer.toLowerCase() !== 'y') {
            logger.info('Workflow aborted by user');
            return {
              success: false,
              reason: 'aborted_by_user'
            };
          }
        }
      }
    }
    
    // Capture baseline screenshots if needed
    if (workflowOptions.captureBaseline) {
      logger.info('Capturing baseline screenshots');
      await captureBaselineScreenshots();
    }
    
    // Introduce visual bug if requested
    if (workflowOptions.introduceBug) {
      logger.info(`Introducing visual bug: ${workflowOptions.bugType}`);
      await introduceVisualBug(workflowOptions.bugType);
    }
    
    // Capture current screenshots
    logger.info('Capturing current screenshots');
    await captureCurrentScreenshots();
    
    // Compare screenshots
    logger.info('Comparing screenshots');
    const comparisonResults = await compareAllScreenshots(workflowOptions.threshold);
    
    // Apply AI analysis if available
    let enhancedResults = [...comparisonResults];
    let aiAnalysisSuccess = false;
    
    if (aiAvailable && !workflowOptions.skipAiAnalysis) {
      logger.info('Applying OpenAI analysis to visual differences');
      
      try {
        for (let i = 0; i < enhancedResults.length; i++) {
          const result = enhancedResults[i];
          
          // Skip if no differences
          if (result.diffPercentage === 0) {
            continue;
          }
          
          // Analyze visual difference
          logger.info(`Analyzing visual difference for: ${result.name}`);
          
          try {
            // Verify diff image exists before attempting analysis
            try {
              // Get basename and handle cases without diff- prefix
              const basename = path.basename(result.diffImagePath || '');
              let basenames = [basename];
              
              // Add variations with and without diff- prefix
              if (basename.startsWith('diff-')) {
                basenames.push(basename.substring(5)); // Without 'diff-' prefix
              } else {
                basenames.push(`diff-${basename}`); // With 'diff-' prefix
              }
              
              // Generate all possible paths to check
              let possiblePaths = [];
              
              // Add the original path first
              possiblePaths.push(result.diffImagePath);
              
              // Add all variations of paths for each basename
              for (const name of basenames) {
                possiblePaths.push(
                  path.join(process.cwd(), 'reports', name),
                  path.join(process.cwd(), 'screenshots', 'diff', name),
                  path.join(process.cwd(), 'screenshots', name)
                );
              }
              
              // Remove duplicates
              possiblePaths = [...new Set(possiblePaths)];
              
              let actualPath = null;
              
              // Try each possible path
              for (const tryPath of possiblePaths) {
                try {
                  await fs.promises.access(tryPath);
                  actualPath = tryPath;
                  logger.info(`Found diff image at: ${tryPath}`);
                  break;
                } catch (error) {
                  // Continue to the next path
                }
              }
              
              // If no path found, attempt to create a placeholder diff image
              if (!actualPath) {
                logger.warn(`Diff image not found at any expected location: ${result.diffImagePath}`);
                logger.info('Attempting to create a placeholder diff image...');
                
                try {
                  // Create a simple red placeholder image
                  const { PNG } = require('pngjs');
                  
                  // Default dimensions if we can't determine them
                  const width = 800;
                  const height = 600;
                  
                  // Create a new PNG image
                  const image = new PNG({ width, height });
                  
                  // Fill with red pixels
                  for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                      const idx = (y * width + x) << 2;
                      image.data[idx] = 255;      // R
                      image.data[idx + 1] = 0;    // G
                      image.data[idx + 2] = 0;    // B
                      image.data[idx + 3] = 255;  // A
                    }
                  }
                  
                  // Use a reliable path in reports directory
                  const placeholderPath = path.join(process.cwd(), 'reports', `diff-${result.name}`);
                  
                  // Write the placeholder image
                  const buffer = PNG.sync.write(image);
                  await fs.promises.writeFile(placeholderPath, buffer);
                  
                  logger.info(`Created placeholder diff image at: ${placeholderPath}`);
                  actualPath = placeholderPath;
                } catch (placeholderError) {
                  logger.error(`Failed to create placeholder image: ${placeholderError.message}`);
                  throw new Error(`Diff image not found and couldn't create placeholder`);
                }
              }
              
              // Update the result's diffImagePath to the actual path
              result.diffImagePath = actualPath;
              
            } catch (fileError) {
              logger.error(`Error locating diff image: ${fileError.message}`);
              throw new Error(`Diff image access error: ${fileError.message}`);
            }
            
            const aiAnalysis = await analyzeVisualDifference(result);
            
            // Perform basic validation of the analysis object
            if (typeof aiAnalysis !== 'object') {
              throw new Error(`AI analysis returned invalid result: ${typeof aiAnalysis}`);
            }
            
            // Make sure we have the raw analysis for display
            if (!aiAnalysis.rawAnalysis && aiAnalysis.description) {
              aiAnalysis.rawAnalysis = aiAnalysis.description;
            }
            
            // Make sure hasDifferences field exists
            aiAnalysis.hasDifferences = true;
            
            // Simplify - skip false positive detection
            aiAnalysisSuccess = true;
            
            // Add to result
            enhancedResults[i] = {
              ...result,
              aiAnalysis
            };
          } catch (analysisError) {
            logger.error(`Error analyzing ${result.name}: ${analysisError.message}`);
            
            // Add a basic analysis with the error
            enhancedResults[i] = {
              ...result,
              aiAnalysis: {
                hasDifferences: result.diffPercentage > 0,
                error: analysisError.message,
                changeType: 'UNKNOWN',
                severity: result.diffPercentage > 5 ? 'HIGH' : 
                         result.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
                confidence: 0.5,
                summary: `Failed to analyze ${result.diffPercentage.toFixed(2)}% pixel difference`,
                description: `AI analysis failed: ${analysisError.message}`,
                isFalsePositive: false
              }
            };
          }
        }
        
        // Generate AI-enhanced report
        logger.info('Generating OpenAI-enhanced report');
        
        // Ensure diff images are in the reports directory with standardized names
        logger.info('Ensuring images are available in reports directory');
        for (const result of enhancedResults) {
          try {
            // Define the destination filenames in reports directory
            const baselineFilename = `baseline-${result.name}`;
            const currentFilename = `current-${result.name}`;
            const diffFilename = `diff-${result.name}`;
            
            // Define full paths in reports directory
            const baselinePath = path.join(process.cwd(), 'reports', baselineFilename);
            const currentPath = path.join(process.cwd(), 'reports', currentFilename);
            const diffPath = path.join(process.cwd(), 'reports', diffFilename);
            
            // Copy the files to reports directory
            fs.copyFileSync(result.baselineImagePath, baselinePath);
            fs.copyFileSync(result.currentImagePath, currentPath);
            if (result.diffPercentage > 0) {
              fs.copyFileSync(result.diffImagePath, diffPath);
            }
            
            // Update paths in the result to use simple filenames
            result.baselineImagePath = baselineFilename;
            result.currentImagePath = currentFilename;
            result.diffImagePath = diffFilename;
            
            logger.debug(`Copied all images for ${result.name} to reports directory`);
          } catch (copyError) {
            logger.warn(`Failed to copy images for ${result.name}: ${copyError.message}`);
          }
        }
        const reportPath = await generateAiReport(enhancedResults);
        
        logger.info('OpenAI-enhanced visual testing workflow complete');
        logger.info(`Report available at: ${reportPath}`);
        
        // Store server information in the global scope for reuse
        global.serverProcess = server;
        
        // Stop server if we started it and keepServerRunning option is not set
        if (server && !server.alreadyRunning && server.pid && !workflowOptions.keepServerRunning) {
          process.kill(server.pid);
        } else if (workflowOptions.keepServerRunning) {
          logger.info('Keeping server running for downstream processes...');
        }
        
        return {
          success: true,
          results: enhancedResults,
          reportPath,
          aiAnalysisApplied: true,
          aiAnalysisSuccess: aiAnalysisSuccess,
          server: server // Include server info in the result
        };
      } catch (aiError) {
        logger.error(`Error in AI analysis phase: ${aiError.message}`);
        logger.info('Falling back to basic report generation');
        
        // Fall back to basic report
        const { generateHtmlReport } = require('../phase1/workflow');
        const reportPath = await generateHtmlReport(comparisonResults);
        
        return {
          success: true,
          results: comparisonResults,
          reportPath,
          aiAnalysisApplied: false,
          aiError: aiError.message
        };
      }
    } else {
      // Generate basic report without AI
      const { generateHtmlReport } = require('../phase1/workflow');
      const reportPath = await generateHtmlReport(comparisonResults);
      
      logger.info('Visual testing workflow complete without AI analysis');
      logger.info(`Report available at: ${reportPath}`);
      
      // Store server information in the global scope for reuse
      global.serverProcess = server;
      
      // Stop server if we started it and keepServerRunning option is not set
      if (server && !server.alreadyRunning && server.pid && !workflowOptions.keepServerRunning) {
        process.kill(server.pid);
      } else if (workflowOptions.keepServerRunning) {
        logger.info('Keeping server running for downstream processes...');
      }
      
      return {
        success: true,
        results: comparisonResults,
        reportPath,
        aiAnalysisApplied: false,
        server: server // Include server info in the result
      };
    }
  } catch (error) {
    logger.error(`Error in OpenAI visual testing workflow: ${error.message}`);
    logger.error(error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Export functions
module.exports = {
  runAiVisualTestingWorkflow,
  ensureServerRunning,
  checkAiAvailability,
  generateAiReport
};

// If this script is run directly, run the workflow
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  const options = {
    captureBaseline: args.includes('--baseline'),
    introduceBug: args.includes('--bug'),
    bugType: args.find(arg => arg.startsWith('--bug-type='))?.split('=')[1] || 'color',
    threshold: parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '0.1'),
    skipAiAnalysis: args.includes('--skip-ai'),
    forceContinue: args.includes('--force'),
    apiKey: process.env.OPENAI_API_KEY
  };
  
  runAiVisualTestingWorkflow(options);
}
