/**
 * phase3-workflow.js
 * 
 * Phase 3 workflow that extends the AI workflow with code analysis, 
 * issue localization, and recommendations.
 */

const path = require('path');
const fs = require('fs').promises;
const { runAiVisualTestingWorkflow } = require('../phase2/ai-workflow');
const { CodeAnalyzer } = require('./code-analyzer');
const { UiCodeMapper } = require('./ui-code-mapper');
const { IssueLocalizer } = require('./issue-localizer');
const { CodeRecommendationGenerator } = require('./code-recommendation');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Enable file logging
logger.enableFileLogging('phase3-workflow.log');

/**
 * Runs the Phase 3 workflow with code analysis and issue localization
 * 
 * @param {Object} options - Workflow options
 * @returns {Promise<Object>} - Workflow results
 */
async function runPhase3Workflow(options = {}) {
  logger.info('Starting Phase 3 workflow: Code Analysis & Issue Localization');
  
  try {
    // Ensure required directories exist
    await ensureRequiredDirectories();
    
    // First, run the AI workflow from Phase 2
    const aiWorkflowResult = await runAiVisualTestingWorkflow({
      ...options,
      keepServerRunning: true // Always keep server running for Phase 3
    });
    
    if (!aiWorkflowResult.success) {
      logger.error(`Phase 2 workflow failed: ${aiWorkflowResult.reason || aiWorkflowResult.error}`);
      return aiWorkflowResult;
    }
    
    logger.info('Phase 2 workflow completed successfully');
    
    // Ensure we have a reference to the server
    const server = aiWorkflowResult.server || global.serverProcess;
    
    // Make sure the server is still running
    let serverRunning = false;
    if (server) {
      try {
        // Check if server is still accessible
        const http = require('http');
        await new Promise((resolve, reject) => {
          const req = http.get(`http://${getConfig('server.host', 'localhost')}:${getConfig('server.port', 3000)}/api/status`, (res) => {
            if (res.statusCode === 200) {
              serverRunning = true;
              resolve();
            } else {
              reject(new Error(`Server responded with status code ${res.statusCode}`));
            }
          });
          
          req.on('error', reject);
          req.setTimeout(3000, () => reject(new Error('Connection timed out')));
          req.end();
        });
      } catch (error) {
        logger.error(`Server connection failed: ${error.message}`);
        serverRunning = false;
      }
    }
    
    if (!serverRunning) {
      logger.error("Server is not running. Cannot proceed with UI analysis.");
      
      // Try to start the server
      logger.info("Attempting to restart the server...");
      try {
        // Import server module
        const { startServer } = require('../server');
        const port = getConfig('server.port', 3000);
        const host = getConfig('server.host', 'localhost');
        
        // Start server
        const newServer = await startServer(port, host);
        logger.info(`Server restarted successfully on port ${port}`);
        
        // Store server in global scope
        global.serverProcess = newServer;
        
        serverRunning = true;
      } catch (serverError) {
        logger.error(`Failed to restart server: ${serverError.message}`);
        
        return {
          ...aiWorkflowResult,
          phase3Applied: false,
          reason: 'server_not_running'
        };
      }
    }
    
    // Check if there are any differences to analyze
    const hasDifferences = aiWorkflowResult.results.some(result => 
      result.diffPercentage > 0 && 
      (!result.aiAnalysis || !result.aiAnalysis.isFalsePositive)
    );
    
    if (!hasDifferences) {
      logger.info('No visual differences to analyze for code localization');
      return {
        ...aiWorkflowResult,
        phase3Applied: false,
        reason: 'no_visual_differences'
      };
    }
    
    // Proceed with code analysis
    logger.info('Analyzing codebase structure...');
    const codeAnalyzer = new CodeAnalyzer({
      rootDir: path.resolve(process.cwd(), 'public')
    });
    
    const codebaseMap = await codeAnalyzer.analyzeCodebase();
    
    // Map UI elements to code with error handling
    let uiCodeMapper;
    try {
      // Attempt to map UI elements to code
      logger.info('Mapping UI elements to code components...');
      uiCodeMapper = new UiCodeMapper(codebaseMap);
      await uiCodeMapper.mapUiElementsToCode();
    } catch (error) {
      logger.warn(`Unable to map UI elements to code: ${error.message}`);
      logger.info('Using mock UI-Code mapping for testing...');
      
      // Create a mock UI-Code mapper similar to the one in phase3-test.js
      const { UiElement } = require('./ui-code-mapper');
      
      uiCodeMapper = {
        codebaseMap,
        uiElements: {},
        
        // Implementation of required methods
        getElementBySelector(selector) {
          return this.uiElements[selector] || null;
        },
        
        getElementsByBoundingBox(box) {
          return Object.values(this.uiElements).filter(element => {
            const elementBox = element.boundingBox;
            if (!elementBox) return false;
            
            // Check if the element's bounding box intersects with the given box
            return !(
              elementBox.x + elementBox.width < box.x ||
              elementBox.x > box.x + box.width ||
              elementBox.y + elementBox.height < box.y ||
              elementBox.y > box.y + box.height
            );
          });
        },
        
        findElements(criteria) {
          return Object.values(this.uiElements).filter(element => {
            for (const [key, value] of Object.entries(criteria)) {
              if (key === 'selector' && element.selector !== value) {
                return false;
              } else if (key === 'boundingBox') {
                continue;
              } else if (!element.attributes[key] || !element.attributes[key].includes(value)) {
                return false;
              }
            }
            return true;
          });
        }
      };
      
      // Add mock elements based on the codebase analysis
      const htmlFiles = Object.values(codebaseMap.components)
        .filter(component => component.type === 'html');
      
      // Extract element IDs from HTML components
      htmlFiles.forEach(component => {
        component.elements
          .filter(el => el.type === 'id')
          .forEach(element => {
            const mockElement = new UiElement(
              `#${element.value}`,
              {
                id: element.value,
                tagName: 'DIV', // Default
              },
              {
                x: 0, y: 0, width: 100, height: 50 // Default
              }
            );
            
            mockElement.addCodeReference(
              component.filePath,
              element.line,
              `Element with ID "${element.value}"`
            );
            
            uiCodeMapper.uiElements[`#${element.value}`] = mockElement;
          });
      });
      
      // Extract class elements
      htmlFiles.forEach(component => {
        component.elements
          .filter(el => el.type === 'class')
          .forEach(element => {
            const selector = `.${element.value}`;
            // Only add if not already added
            if (!uiCodeMapper.uiElements[selector]) {
              const mockElement = new UiElement(
                selector,
                {
                  className: element.value,
                  tagName: 'DIV', // Default
                },
                {
                  x: 0, y: 0, width: 100, height: 50 // Default
                }
              );
              
              mockElement.addCodeReference(
                component.filePath,
                element.line,
                `Element with class "${element.value}"`
              );
              
              uiCodeMapper.uiElements[selector] = mockElement;
            }
          });
      });
      
      logger.info(`Created ${Object.keys(uiCodeMapper.uiElements).length} mock UI elements from code analysis`);
    }
    
    // Identify modified files (if applicable)
    const modifiedFiles = await getModifiedFiles();
    if (modifiedFiles.length > 0) {
      logger.info(`Marking ${modifiedFiles.length} files as modified in codebase map`);
      codebaseMap.markModifiedComponents(modifiedFiles);
    }
    
    // Initialize issue localizer
    logger.info('Localizing visual issues in code...');
    const issueLocalizer = new IssueLocalizer(uiCodeMapper, codebaseMap);
    
    // Localize issues using visual differences
    const localizedIssues = await issueLocalizer.localizeIssues(
      aiWorkflowResult.results.filter(r => r.diffPercentage > 0)
    );
    
    // Generate code recommendations
    logger.info('Generating code recommendations...');
    const recommendationGenerator = new CodeRecommendationGenerator();
    
    const recommendations = [];
    for (const issue of localizedIssues) {
      const recommendation = await recommendationGenerator.generateRecommendations(issue);
      recommendations.push(recommendation);
    }
    
    // Generate enhanced report with code localization and recommendations
    logger.info('Generating enhanced report with code references...');
    const enhancedReportPath = await generateEnhancedReport(
      aiWorkflowResult.results,
      localizedIssues,
      recommendations
    );
    
    logger.info('Phase 3 workflow completed successfully');
    logger.info(`Enhanced report available at: ${enhancedReportPath}`);
    
    // Store server info in the result to ensure it's not lost
    return {
      ...aiWorkflowResult,
      phase3Applied: true,
      localizedIssues,
      recommendations,
      enhancedReportPath,
      server: server // Preserve server info
    };
    
  } catch (error) {
    logger.error(`Error in Phase 3 workflow: ${error.message}`);
    logger.error(error.stack);
    
    return {
      success: false,
      error: error.message,
      phase3Error: true
    };
  }
}

/**
 * Get a list of modified files (can be extended to integrate with Git)
 * 
 * @returns {Promise<Array>} - List of modified file paths
 */
async function getModifiedFiles() {
  // This is a placeholder implementation
  // In a real implementation, this would integrate with Git to get recently modified files
  
  try {
    // For the POC, we can use a simple file tracking system
    const modifiedFilesPath = path.join(process.cwd(), 'modified_files.txt');
    
    // Check if the file exists
    try {
      await fs.access(modifiedFilesPath);
    } catch (err) {
      // File doesn't exist, return empty array
      return [];
    }
    
    // Read and parse the file
    const content = await fs.readFile(modifiedFilesPath, 'utf-8');
    return content.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(relativePath => path.resolve(process.cwd(), 'public', relativePath));
    
  } catch (error) {
    logger.warn(`Error getting modified files: ${error.message}`);
    return [];
  }
}

/**
 * Generates an enhanced HTML report with issue localization and recommendations
 * 
 * @param {Array} comparisonResults - Visual comparison results 
 * @param {Array} localizedIssues - Localized issues with code references
 * @param {Array} recommendations - Code recommendations
 * @returns {Promise<string>} - Path to the generated report
 */
async function generateEnhancedReport(comparisonResults, localizedIssues, recommendations) {
  logger.info('Generating enhanced HTML report...');
  
  try {
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    try {
      await fs.mkdir(reportsDir, { recursive: true });
    } catch (err) {
      // Directory already exists
    }
    
    // Generate a timestamp for the report name
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const reportPath = path.join(reportsDir, `phase3-report-${timestamp}.html`);
    
    // Combine the results with localized issues by name
    const enhancedResults = comparisonResults.map(result => {
      // Find any localized issues for this result
      const matchingIssues = localizedIssues.filter(issue => 
        issue.comparisonResult.name === result.name
      );
      
      // Find matching recommendations
      const matchingRecommendations = recommendations.filter(rec => 
        matchingIssues.some(issue => issue === rec.issue)
      );
      
      return {
        ...result,
        localizedIssues: matchingIssues,
        recommendations: matchingRecommendations
      };
    });
    
    // Perform a final check to ensure diff images are available for the report
    await ensureDiffImagesForReport(enhancedResults);
    
    // Generate report HTML
    const reportHtml = generateHtmlContent(enhancedResults);
    
    // Write the report file
    await fs.writeFile(reportPath, reportHtml);
    
    logger.info(`Enhanced report saved to: ${reportPath}`);
    
    return reportPath;
  } catch (error) {
    logger.error(`Error generating enhanced report: ${error.message}`);
    throw error;
  }
}

/**
 * Generates HTML content for the enhanced report
 * 
 * @param {Array} enhancedResults - Results with localized issues and recommendations
 * @returns {string} - HTML content for the report
 */
function generateHtmlContent(enhancedResults) {
  // Helper to get a web-friendly path
  const getWebPath = (filePath) => {
    if (!filePath) return '';
    
    // If already a simple filename, just return it
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      return filePath;
    }
    
    // Extract the filename only for better compatibility
    const basename = path.basename(filePath);
    
    // Return just the filename
    return basename;
  };
  
  // Helper to encode HTML
  const encodeHtml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Helper to get relative file path
  const getRelativePath = (filePath) => {
    const publicDir = path.resolve(process.cwd(), 'public');
    return filePath.startsWith(publicDir) 
      ? filePath.substring(publicDir.length + 1) 
      : filePath;
  };
  
  // Create HTML document
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Visual Testing - Phase 3 Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3, h4 {
      color: #2c3e50;
    }
    .report-header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 20px;
    }
    .timestamp {
      color: #7f8c8d;
      font-size: 14px;
    }
    .comparison-container {
      margin-bottom: 40px;
      border: 1px solid #ddd;
      border-radius: 5px;
      overflow: hidden;
    }
    .comparison-header {
      background-color: #f8f9fa;
      padding: 15px;
      border-bottom: 1px solid #ddd;
    }
    .comparison-header h3 {
      margin: 0;
    }
    .images-container {
      display: flex;
      flex-wrap: wrap;
      padding: 15px;
      gap: 10px;
    }
    .image-box {
      flex: 1;
      min-width: 250px;
      text-align: center;
    }
    .image-box img {
      max-width: 100%;
      border: 1px solid #ddd;
    }
    .image-label {
      font-weight: bold;
      margin: 10px 0;
    }
    .info-container {
      padding: 15px;
      border-top: 1px solid #ddd;
    }
    .info-container p {
      margin: 5px 0;
    }
    .diff-info {
      font-weight: bold;
    }
    .diff-high {
      color: #e74c3c;
    }
    .diff-medium {
      color: #f39c12;
    }
    .diff-low {
      color: #2ecc71;
    }
    .ai-analysis {
      margin-top: 20px;
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #3498db;
    }
    .false-positive {
      background-color: #eafaf1;
      border-left-color: #2ecc71;
    }
    .code-localization {
      margin-top: 20px;
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #9b59b6;
    }
    .code-reference {
      font-family: monospace;
      background-color: #f1f1f1;
      padding: 10px;
      margin: 10px 0;
      border-radius: 3px;
      white-space: pre-wrap;
    }
    .recommendations {
      margin-top: 20px;
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #e67e22;
    }
    .recommendation {
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    .recommendation-confidence {
      float: right;
      font-size: 14px;
      color: #7f8c8d;
    }
    .confidence-high {
      color: #2ecc71;
    }
    .confidence-medium {
      color: #f39c12;
    }
    .confidence-low {
      color: #e74c3c;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid #ddd;
      margin-bottom: 15px;
    }
    .tab {
      padding: 10px 15px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .tab.active {
      border: 1px solid #ddd;
      border-bottom-color: white;
      border-radius: 5px 5px 0 0;
      margin-bottom: -1px;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .summary {
      background-color: #f8f9fa;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 5px;
    }
    .filters {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .filter-button {
      padding: 8px 12px;
      background-color: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    }
    .filter-button.active {
      background-color: #3498db;
      color: white;
      border-color: #2980b9;
    }
    footer {
      text-align: center;
      margin-top: 40px;
      color: #7f8c8d;
      font-size: 14px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>AI Visual Testing - Phase 3 Report</h1>
    <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <h2>Test Summary</h2>
    <p>Total tests: ${enhancedResults.length}</p>
    <p>Tests with differences: ${enhancedResults.filter(r => r.hasDifferences).length}</p>
    <p>False positives detected: ${enhancedResults.filter(r => r.aiAnalysis?.isFalsePositive).length}</p>
    <p>Tests with localized issues: ${enhancedResults.filter(r => (r.localizedIssues?.length || 0) > 0).length}</p>
    <p>Tests with recommendations: ${enhancedResults.filter(r => (r.recommendations?.length || 0) > 0).length}</p>
  </div>
  
  <div class="filters">
    <button class="filter-button active" data-filter="all">All</button>
    <button class="filter-button" data-filter="differences">With Differences</button>
    <button class="filter-button" data-filter="localized">With Localized Issues</button>
    <button class="filter-button" data-filter="recommendations">With Recommendations</button>
    <button class="filter-button" data-filter="false-positives">False Positives</button>
  </div>
`;

  // Add comparison results
  enhancedResults.forEach(result => {
    const diffClass = result.diffPercentage > 5 ? 'diff-high' : 
                      result.diffPercentage > 1 ? 'diff-medium' : 'diff-low';
    
    const filterClasses = [
      'comparison-container',
      'filter-item',
      result.hasDifferences ? 'filter-differences' : '',
      (result.localizedIssues?.length || 0) > 0 ? 'filter-localized' : '',
      (result.recommendations?.length || 0) > 0 ? 'filter-recommendations' : '',
      result.aiAnalysis?.isFalsePositive ? 'filter-false-positives' : ''
    ].filter(Boolean).join(' ');
    
    html += `
  <div class="${filterClasses}">
    <div class="comparison-header">
      <h3>${result.name}</h3>
    </div>
    
    <div class="images-container">
      <div class="image-box">
        <div class="image-label">Baseline</div>
        <img src="${getWebPath(result.baselineImagePath)}" alt="Baseline Image">
      </div>
      
      <div class="image-box">
        <div class="image-label">Current</div>
        <img src="${getWebPath(result.currentImagePath)}" alt="Current Image">
      </div>
      
      <div class="image-box">
        <div class="image-label">Difference</div>
        <img src="${getWebPath(result.diffImagePath)}" alt="Difference Image">
      </div>
    </div>
    
    <div class="info-container">
      <div class="tabs">
        <div class="tab active" data-tab="overview-${result.name}">Overview</div>
        <div class="tab" data-tab="ai-analysis-${result.name}">AI Analysis</div>
        <div class="tab" data-tab="code-localization-${result.name}">Code Localization</div>
        <div class="tab" data-tab="recommendations-${result.name}">Recommendations</div>
      </div>
      
      <div class="tab-content active" id="overview-${result.name}">
        <p>Test result: <strong>${result.hasDifferences ? 'Differences Detected' : 'No Differences'}</strong></p>
        <p class="diff-info ${diffClass}">Difference: ${result.diffPercentage.toFixed(2)}% (${result.diffPixelCount} pixels)</p>
        <p>Threshold: ${result.threshold}</p>
        <p>Resolution: ${result.width}x${result.height}</p>
        <p>Page Name: ${result.name}</p>
        ${result.aiAnalysis?.isFalsePositive ? '<p><strong>Identified as a false positive by AI analysis</strong></p>' : ''}
      </div>
      
      <div class="tab-content" id="ai-analysis-${result.name}">
`;

    // Add AI analysis
    if (result.aiAnalysis) {
      const aiClass = result.aiAnalysis.isFalsePositive ? 'ai-analysis false-positive' : 'ai-analysis';
      
      html += `
        <div class="${aiClass}">
          <h4>AI Analysis</h4>
          ${result.aiAnalysis.error ? `<p><strong>Error: ${result.aiAnalysis.error}</strong></p>` : ''}
          <p><strong>Change Type:</strong> ${result.aiAnalysis.changeType || 'Unknown'}</p>
          <p><strong>Severity:</strong> ${result.aiAnalysis.severity || 'Unknown'}</p>
          <p><strong>Confidence:</strong> ${(result.aiAnalysis.confidence * 100).toFixed(0)}%</p>
          <p><strong>False Positive:</strong> ${result.aiAnalysis.isFalsePositive ? 'Yes' : 'No'}</p>
          <p><strong>Summary:</strong> ${result.aiAnalysis.summary || 'No summary available'}</p>
          <p><strong>Description:</strong> ${result.aiAnalysis.description || 'No description available'}</p>
        </div>
`;
    } else {
      html += `
        <p>No AI analysis available for this comparison.</p>
`;
    }

    html += `
      </div>
      
      <div class="tab-content" id="code-localization-${result.name}">
`;

    // Add code localization
    if (result.localizedIssues && result.localizedIssues.length > 0) {
      result.localizedIssues.forEach((issue, issueIndex) => {
        html += `
        <div class="code-localization">
          <h4>Issue ${issueIndex + 1}</h4>
          
          <h5>Affected UI Elements</h5>
          <ul>
`;

        if (issue.affectedElements && issue.affectedElements.length > 0) {
          issue.affectedElements.forEach(element => {
            html += `
            <li>
              <strong>${element.selector}</strong> 
              (Overlap: ${(element.overlapPercentage * 100).toFixed(0)}%)
            </li>
`;
          });
        } else {
          html += `
            <li>No affected UI elements identified</li>
`;
        }

        html += `
          </ul>
          
          <h5>Code References</h5>
          <ul>
`;

        if (issue.codeReferences && issue.codeReferences.length > 0) {
          issue.getSortedCodeReferences().forEach(ref => {
            const confidenceClass = ref.confidence > 0.7 ? 'confidence-high' : 
                                 ref.confidence > 0.4 ? 'confidence-medium' : 'confidence-low';
            
            html += `
            <li>
              <span class="recommendation-confidence ${confidenceClass}">
                Confidence: ${(ref.confidence * 100).toFixed(0)}%
              </span>
              <strong>${getRelativePath(ref.filePath)}</strong> (Line ${ref.lineNumber})
              <div class="code-reference">${encodeHtml(ref.context)}</div>
            </li>
`;
          });
        } else {
          html += `
            <li>No code references identified</li>
`;
        }

        html += `
          </ul>
        </div>
`;
      });
    } else {
      html += `
        <p>No code localization available for this comparison.</p>
`;
    }

    html += `
      </div>
      
      <div class="tab-content" id="recommendations-${result.name}">
`;

    // Add recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      result.recommendations.forEach((rec, recIndex) => {
        html += `
        <div class="recommendations">
          <h4>Recommendation ${recIndex + 1}</h4>
          <ul>
`;

        if (rec.recommendations && rec.recommendations.length > 0) {
          rec.recommendations.forEach(r => {
            const confidenceClass = r.confidence > 0.7 ? 'confidence-high' : 
                                 r.confidence > 0.4 ? 'confidence-medium' : 'confidence-low';
            
            html += `
            <li class="recommendation">
              <span class="recommendation-confidence ${confidenceClass}">
                Confidence: ${(r.confidence * 100).toFixed(0)}%
              </span>
              <p>${r.description}</p>
`;

            if (r.codeChange) {
              html += `
              <div class="code-reference">
                <strong>File:</strong> ${getRelativePath(r.codeChange.filePath)}
                <strong>Line:</strong> ${r.codeChange.lineNumber}
                <strong>Current Code:</strong> ${r.codeChange.currentContent ? encodeHtml(r.codeChange.currentContent) : 'N/A'}
                <strong>Suggested Fix:</strong> ${r.codeChange.suggestedFix ? encodeHtml(r.codeChange.suggestedFix) : 'N/A'}
              </div>
`;
            }

            html += `
            </li>
`;
          });
        } else {
          html += `
            <li>No specific recommendations available</li>
`;
        }

        html += `
          </ul>
        </div>
`;
      });
    } else {
      html += `
        <p>No recommendations available for this comparison.</p>
`;
    }

    html += `
      </div>
    </div>
  </div>
`;
  });

  // Add footer and JavaScript
  html += `
  <footer>
    <p>Generated by AI Visual Testing Phase 3 - Code Analysis & Issue Localization</p>
  </footer>

  <script>
    // Tab functionality
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Get the tab content ID
        const tabId = tab.getAttribute('data-tab');
        
        // Get parent tabs container
        const tabsContainer = tab.parentElement;
        
        // Remove active class from all tabs in this container
        tabsContainer.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
        });
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Get parent container (info-container)
        const contentContainer = tabsContainer.parentElement;
        
        // Hide all tab content in this container
        contentContainer.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Show the selected tab content
        document.getElementById(tabId).classList.add('active');
      });
    });
    
    // Filter functionality
    document.querySelectorAll('.filter-button').forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all filter buttons
        document.querySelectorAll('.filter-button').forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Get the filter value
        const filter = button.getAttribute('data-filter');
        
        // Show/hide containers based on filter
        document.querySelectorAll('.comparison-container').forEach(container => {
          if (filter === 'all') {
            container.style.display = 'block';
          } else {
            if (container.classList.contains('filter-' + filter)) {
              container.style.display = 'block';
            } else {
              container.style.display = 'none';
            }
          }
        });
      });
    });
  </script>
</body>
</html>
`;

  return html;
}

/**
 * Ensures that all required directories for the workflow exist
 */
async function ensureRequiredDirectories() {
  logger.info('Ensuring required directories exist...');
  
  try {
    // Create screenshots directory and subdirectories
    const screenshotsDir = path.join(process.cwd(), getConfig('screenshots.directory', './screenshots'));
    await fs.mkdir(path.join(screenshotsDir), { recursive: true });
    await fs.mkdir(path.join(screenshotsDir, 'baseline'), { recursive: true });
    await fs.mkdir(path.join(screenshotsDir, 'current'), { recursive: true });
    await fs.mkdir(path.join(screenshotsDir, 'diff'), { recursive: true });
    
    // Create reports directory
    const reportsDir = path.join(process.cwd(), getConfig('reporting.directory', './reports'));
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Create logs directory
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    logger.info('All required directories created');
  } catch (error) {
    logger.error(`Error creating directories: ${error.message}`);
  }
}

/**
 * Ensures diff images are available for the report by copying them between directories if needed
 * 
 * @param {Array} enhancedResults - Enhanced comparison results
 */
async function ensureDiffImagesForReport(enhancedResults) {
  logger.info('Ensuring diff images are available for the report...');
  
  const reportsDir = path.join(process.cwd(), 'reports');
  
  for (const result of enhancedResults) {
    if (!result.hasDifferences) continue;
    
    try {
      // Define standard filenames
      const baselineFilename = `baseline-${result.name}`;
      const currentFilename = `current-${result.name}`;
      const diffFilename = `diff-${result.name}`;
      
      // Define paths in reports directory
      const baselinePath = path.join(reportsDir, baselineFilename);
      const currentPath = path.join(reportsDir, currentFilename);
      const diffPath = path.join(reportsDir, diffFilename);
      
      // Copy baseline image
      await fs.copyFile(result.baselineImagePath, baselinePath);
      
      // Copy current image
      await fs.copyFile(result.currentImagePath, currentPath);
      
      // Copy diff image
      await fs.copyFile(result.diffImagePath, diffPath);
      
      // Update paths in result to use simple filenames
      result.baselineImagePath = baselineFilename;
      result.currentImagePath = currentFilename;
      result.diffImagePath = diffFilename;
      
      logger.debug(`Copied all images for ${result.name} to reports directory`);
    } catch (error) {
      logger.warn(`Failed to copy images for ${result.name}: ${error.message}`);
    }
  }
  
  logger.info('Diff image check complete for report generation');
}

// Export functions
module.exports = {
  runPhase3Workflow,
  getModifiedFiles,
  generateEnhancedReport,
  ensureDiffImagesForReport
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
    forceContinue: args.includes('--force')
  };
  
  runPhase3Workflow(options);
}
