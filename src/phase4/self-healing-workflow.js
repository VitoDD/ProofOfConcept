/**
 * self-healing-workflow.js
 * 
 * Main workflow for Phase 4 that implements self-healing capabilities
 */

const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { runPhase3Workflow } = require('../phase3/phase3-workflow');
const { FixGenerator } = require('./fix-generator');
const { FixApplier } = require('./fix-applier');
const { FixVerifier } = require('./fix-verifier');
const { getConfig } = require('../utils/config');
const imagePaths = require('./utils/image-paths');
const { IntentConfirmationManager } = require('../utils/intent-confirmation');

// Enable file logging
logger.enableFileLogging('phase4-workflow.log');

// Initialize intent confirmation manager
const intentConfirmationManager = new IntentConfirmationManager();

/**
 * Runs the Phase 4 workflow with self-healing capabilities
 * 
 * @param {Object} options - Workflow options
 * @returns {Promise<Object>} - Workflow results
 */
async function runSelfHealingWorkflow(options = {}) {
  logger.info('Starting Phase 4 workflow: Self-Healing Implementation');
  
  try {
    // Ensure required directories exist
    await ensureRequiredDirectories();
    
    // Initialize intent confirmation manager
    await intentConfirmationManager.initialize();
    
    // First, run the Phase 3 workflow to detect and localize issues
    const phase3Result = await runPhase3Workflow({
      ...options,
      keepServerRunning: true // Always keep server running for Phase 4
    });
    
    if (!phase3Result.success) {
      logger.error(`Phase 3 workflow failed: ${phase3Result.reason || phase3Result.error}`);
      return phase3Result;
    }
    
    logger.info('Phase 3 workflow completed successfully');
    
    // Process the comparison results - register issues for confirmation if needed
    await processComparisonResults(phase3Result.results, options);
    
    // Set the confirmation flag in the result
    phase3Result.requireUserConfirmation = options.confirmationsPending || false;
    
    // Check if there are any issues that need fixing
    if (!phase3Result.localizedIssues || phase3Result.localizedIssues.length === 0) {
      logger.info('No issues to fix, self-healing not required');
      
      return {
        ...phase3Result,
        phase4Applied: false,
        reason: 'no_issues_to_fix'
      };
    }
    
    logger.info(`Found ${phase3Result.localizedIssues.length} issues to fix`);
    
    // Initialize fix generator
    const fixGenerator = new FixGenerator({
      model: getConfig('ai.models.code', 'llama3.2')
    });
    
    // Initialize fix applier
    const fixApplier = new FixApplier({
      dryRun: options.dryRun || false
    });
    
    // Initialize fix verifier
    const fixVerifier = new FixVerifier({
      threshold: options.threshold || 0.1,
      fixApplier
    });
    
    // Process each issue
    const healingResults = [];
    
    for (const issue of phase3Result.localizedIssues) {
      logger.info(`Processing issue in ${issue.comparisonResult.name}`);
      
      // Generate fixes
      const fixes = await fixGenerator.generateFixes(issue);
      
      if (!fixes || fixes.length === 0) {
        logger.warn(`No fixes generated for issue in ${issue.comparisonResult.name}`);
        
        healingResults.push({
          issue: issue.comparisonResult.name,
          status: 'failed',
          reason: 'no_fixes_generated'
        });
        
        continue;
      }
      
      logger.info(`Generated ${fixes.length} potential fixes`);
      
      // Sort fixes by confidence
      const sortedFixes = [...fixes].sort((a, b) => b.confidence - a.confidence);
      
      // Try each fix until one works
      let fixSuccess = false;
      
      for (const fix of sortedFixes) {
        logger.info(`Trying fix with confidence ${fix.confidence.toFixed(2)}`);
        
        // Apply the fix
        const fixResult = await fixApplier.applyFix(fix);
        
        if (fixResult.status !== 'success' && fixResult.status !== 'simulated') {
          logger.warn(`Fix application failed: ${fixResult.error || 'Unknown error'}`);
          continue;
        }
        
        // Verify the fix
        const verificationResult = await fixVerifier.verifyFix(issue, fixResult);
        
        if (verificationResult.status === 'success') {
          logger.info(`Fix verified successfully!`);
          
          // Add to knowledge base
          await fixGenerator.addToKnowledgeBase({
            issue,
            fix: {
              filePath: fix.filePath,
              lineNumber: fix.lineNumber,
              oldCode: fix.currentContent,
              newCode: fix.suggestedFix
            },
            result: {
              status: 'success',
              diffPercentage: verificationResult.diffPercentage
            }
          });
          
          healingResults.push({
            issue: issue.comparisonResult.name,
            status: 'success',
            fix,
            verificationResult
          });
          
          fixSuccess = true;
          break;
        } else {
          logger.warn(`Fix verification failed: ${verificationResult.status}`);
          
          // Revert the fix
          await fixVerifier.revertFix(fixResult);
          
          // Add to knowledge base as failed fix
          await fixGenerator.addToKnowledgeBase({
            issue,
            fix: {
              filePath: fix.filePath,
              lineNumber: fix.lineNumber,
              oldCode: fix.currentContent,
              newCode: fix.suggestedFix
            },
            result: {
              status: 'failed',
              diffPercentage: verificationResult.diffPercentage,
              reason: verificationResult.status
            }
          });
        }
      }
      
      if (!fixSuccess) {
        logger.warn(`All fixes failed for issue in ${issue.comparisonResult.name}`);
        
        healingResults.push({
          issue: issue.comparisonResult.name,
          status: 'failed',
          reason: 'all_fixes_failed',
          fixes: sortedFixes.length
        });
      }
    }
    
    // Generate enhanced report with self-healing results
    logger.info('Generating enhanced report with self-healing results');
    
    const enhancedReportPath = await generateEnhancedReport(
      phase3Result.results,
      phase3Result.localizedIssues,
      phase3Result.recommendations,
      healingResults
    );
    
    // Calculate success metrics
    const successfulFixes = healingResults.filter(r => r.status === 'success').length;
    const totalIssues = healingResults.length;
    const successRate = totalIssues > 0 ? (successfulFixes / totalIssues) * 100 : 0;
    
    logger.info(`Self-healing workflow completed with ${successfulFixes}/${totalIssues} issues fixed (${successRate.toFixed(1)}%)`);
    logger.info(`Enhanced report available at: ${enhancedReportPath}`);
    
    return {
      ...phase3Result,
      phase4Applied: true,
      healingResults,
      successRate,
      enhancedReportPath,
      server: phase3Result.server // Preserve server info
    };
  } catch (error) {
    logger.error(`Error in self-healing workflow: ${error.message}`);
    logger.error(error.stack);
    
    return {
      success: false,
      error: error.message,
      phase4Error: true
    };
  }
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
    await fs.mkdir(path.join(screenshotsDir, 'verification'), { recursive: true });
    
    // Create reports directory
    const reportsDir = path.join(process.cwd(), getConfig('reporting.directory', './reports'));
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Create logs directory
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    // Create backups directory
    const backupsDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupsDir, { recursive: true });
    
    // Create knowledge base directory
    const knowledgeBaseDir = path.join(process.cwd(), 'src', 'phase4', 'data');
    await fs.mkdir(knowledgeBaseDir, { recursive: true });
    
    logger.info('All required directories created');
  } catch (error) {
    logger.error(`Error creating directories: ${error.message}`);
  }
}

/**
 * Generates an enhanced HTML report with self-healing results
 * 
 * @param {Array} comparisonResults - Visual comparison results
 * @param {Array} localizedIssues - Localized issues with code references
 * @param {Array} recommendations - Code recommendations
 * @param {Array} healingResults - Self-healing results
 * @returns {Promise<string>} - Path to the generated report
 */
async function generateEnhancedReport(
  comparisonResults, 
  localizedIssues, 
  recommendations,
  healingResults
) {
  logger.info('Generating enhanced HTML report with self-healing results...');
  
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
    const reportPath = path.join(reportsDir, `phase4-report-${timestamp}.html`);
    
    // Combine the results with localized issues and healing results by name
    const enhancedResults = comparisonResults.map(result => {
      // Find any localized issues for this result
      const matchingIssues = localizedIssues.filter(issue => 
        issue.comparisonResult.name === result.name
      );
      
      // Find matching recommendations
      const matchingRecommendations = recommendations.filter(rec => 
        matchingIssues.some(issue => issue === rec.issue)
      );
      
      // Find matching healing results
      const matchingHealingResults = healingResults.filter(hr => 
        hr.issue === result.name
      );
      
      return {
        ...result,
        localizedIssues: matchingIssues,
        recommendations: matchingRecommendations,
        healingResults: matchingHealingResults
      };
    });
    
    // Ensure diff images are available for the report
    await ensureDiffImagesForReport(enhancedResults);
    
    // Generate report HTML
    const reportHtml = generateHtmlContent(enhancedResults, healingResults);
    
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
 * Ensures diff images are available for the report by copying them between directories if needed
 * 
 * @param {Array} enhancedResults - Enhanced comparison results
 */
async function ensureDiffImagesForReport(enhancedResults) {
  logger.info('Ensuring diff images are available for the report...');
  
  const reportsDir = path.join(process.cwd(), 'reports');
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  
  for (const result of enhancedResults) {
    if (!result.hasDifferences) continue;
    
    try {
      // Define standard filenames
      const baselineFilename = `baseline-${result.name}.png`;
      const currentFilename = `current-${result.name}.png`;
      const diffFilename = `diff-${result.name}.png`;
      
      // Define paths in screenshots directory
      const baselinePath = path.join(screenshotsDir, 'baseline', baselineFilename);
      const currentPath = path.join(screenshotsDir, 'current', result.currentImagePath.split('/').pop());
      const diffPath = path.join(screenshotsDir, 'diff', result.diffImagePath.split('/').pop());
      
      // Define target paths in reports directory
      const reportBaselinePath = path.join(reportsDir, baselineFilename);
      const reportCurrentPath = path.join(reportsDir, currentFilename);
      const reportDiffPath = path.join(reportsDir, diffFilename);
      
      // Copy baseline image
      try {
        await fs.copyFile(baselinePath, reportBaselinePath);
      } catch (err) {
        logger.warn(`Failed to copy baseline image: ${err.message}`);
        // Try to find the baseline image in another location
        try {
          const alternativeBaselinePath = result.baselineImagePath;
          await fs.copyFile(alternativeBaselinePath, reportBaselinePath);
          logger.info(`Copied baseline image from alternative path: ${alternativeBaselinePath}`);
        } catch (innerErr) {
          logger.warn(`Failed to copy baseline image from alternative path: ${innerErr.message}`);
        }
      }
      
      // Copy current image
      try {
        await fs.copyFile(currentPath, reportCurrentPath);
      } catch (err) {
        logger.warn(`Failed to copy current image: ${err.message}`);
        // Try to copy from the direct path
        try {
          await fs.copyFile(result.currentImagePath, reportCurrentPath);
          logger.info(`Copied current image from direct path: ${result.currentImagePath}`);
        } catch (innerErr) {
          logger.warn(`Failed to copy current image from direct path: ${innerErr.message}`);
        }
      }
      
      // Copy diff image
      try {
        await fs.copyFile(diffPath, reportDiffPath);
      } catch (err) {
        logger.warn(`Failed to copy diff image: ${err.message}`);
        // Try to copy from the direct path
        try {
          await fs.copyFile(result.diffImagePath, reportDiffPath);
          logger.info(`Copied diff image from direct path: ${result.diffImagePath}`);
        } catch (innerErr) {
          logger.warn(`Failed to copy diff image from direct path: ${innerErr.message}`);
        }
      }
      
      // Update paths in result to use simple filenames
      result.baselineImagePath = baselineFilename;
      result.currentImagePath = currentFilename;
      result.diffImagePath = diffFilename;
      
      // Copy any verification images if available
      if (result.healingResults && result.healingResults.length > 0) {
        for (const healingResult of result.healingResults) {
          if (healingResult.status === 'success' && healingResult.verificationResult) {
            const verificationPath = healingResult.verificationResult.verificationScreenshotPath;
            const verificationDiffPath = healingResult.verificationResult.diffImagePath;
            
            if (verificationPath) {
              const verificationFilename = `verification-${result.name}.png`;
              const reportVerificationPath = path.join(reportsDir, verificationFilename);
              
              try {
                await fs.copyFile(verificationPath, reportVerificationPath);
                healingResult.verificationResult.verificationScreenshotPath = verificationFilename;
              } catch (err) {
                logger.warn(`Failed to copy verification image: ${err.message}`);
              }
            }
            
            if (verificationDiffPath) {
              const verificationDiffFilename = `verification-diff-${result.name}.png`;
              const reportVerificationDiffPath = path.join(reportsDir, verificationDiffFilename);
              
              try {
                await fs.copyFile(verificationDiffPath, reportVerificationDiffPath);
                healingResult.verificationResult.diffImagePath = verificationDiffFilename;
              } catch (err) {
                logger.warn(`Failed to copy verification diff image: ${err.message}`);
              }
            }
          }
        }
      }
      
      logger.debug(`Copied all images for ${result.name} to reports directory`);
    } catch (error) {
      logger.warn(`Failed to copy images for ${result.name}: ${error.message}`);
    }
  }
  
  logger.info('Image preparation complete for report generation');
}

/**
 * Generates HTML content for the enhanced report with self-healing results
 * 
 * @param {Array} enhancedResults - Results with localized issues, recommendations, and healing results
 * @param {Array} healingResults - Overall healing results
 * @returns {string} - HTML content for the report
 */
function generateHtmlContent(enhancedResults, healingResults) {
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
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Helper to get relative file path
  const getRelativePath = (filePath) => {
    if (!filePath) return '';
    
    const publicDir = path.resolve(process.cwd(), 'public');
    return filePath.startsWith(publicDir) 
      ? filePath.substring(publicDir.length + 1) 
      : filePath;
  };
  
  // Calculate overall metrics
  const totalIssues = healingResults.length;
  const successfulFixes = healingResults.filter(r => r.status === 'success').length;
  const successRate = totalIssues > 0 ? (successfulFixes / totalIssues) * 100 : 0;
  
  // Create HTML document
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Visual Testing - Self-Healing Report</title>
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
    .healing-results {
      margin-top: 20px;
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #1abc9c;
    }
    .healing-success {
      background-color: #e8f8f5;
      border-left-color: #1abc9c;
    }
    .healing-failure {
      background-color: #fef2f0;
      border-left-color: #e74c3c;
    }
    .healing-result {
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    .healing-status {
      font-weight: bold;
    }
    .healing-success-status {
      color: #1abc9c;
    }
    .healing-failure-status {
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
    .metrics {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }
    .metric-card {
      flex: 1;
      margin: 0 10px;
      padding: 15px;
      background-color: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      text-align: center;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0;
    }
    .metric-label {
      color: #7f8c8d;
      font-size: 14px;
    }
    .success-rate {
      color: #1abc9c;
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
    .before-after-container {
      display: flex;
      gap: 20px;
      margin-top: 10px;
    }
    .before-after-box {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 10px;
    }
    .before-after-header {
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
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
    <h1>AI Visual Testing - Self-Healing Report</h1>
    <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <h2>Test Summary</h2>
    
    <div class="metrics">
      <div class="metric-card">
        <div class="metric-label">Total Tests</div>
        <div class="metric-value">${enhancedResults.length}</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Tests with Issues</div>
        <div class="metric-value">${healingResults.length}</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Issues Fixed</div>
        <div class="metric-value">${successfulFixes}</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value success-rate">${successRate.toFixed(1)}%</div>
      </div>
    </div>
  </div>
  
  <div class="filters">
    <button class="filter-button active" data-filter="all">All</button>
    <button class="filter-button" data-filter="differences">With Differences</button>
    <button class="filter-button" data-filter="healed">Automatically Fixed</button>
    <button class="filter-button" data-filter="unfixed">Unfixed Issues</button>
    <button class="filter-button" data-filter="false-positives">False Positives</button>
  </div>
`;

  // Add comparison results
  enhancedResults.forEach(result => {
    const diffClass = result.diffPercentage > 5 ? 'diff-high' : 
                      result.diffPercentage > 1 ? 'diff-medium' : 'diff-low';
    
    // Check healing status for this result
    const isHealed = result.healingResults && 
                     result.healingResults.some(hr => hr.status === 'success');
    
    const isUnfixed = result.healingResults && 
                     result.healingResults.length > 0 &&
                     !isHealed;
    
    const filterClasses = [
      'comparison-container',
      'filter-item',
      result.hasDifferences ? 'filter-differences' : '',
      isHealed ? 'filter-healed' : '',
      isUnfixed ? 'filter-unfixed' : '',
      result.aiAnalysis?.isFalsePositive ? 'filter-false-positives' : ''
    ].filter(Boolean).join(' ');
    
    html += `
  <div class="${filterClasses}">
    <div class="comparison-header">
      <h3>${result.name} ${isHealed ? '<span style="color: #1abc9c;">[Fixed]</span>' : ''}</h3>
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
      
      ${isHealed && result.healingResults[0].verificationResult?.verificationScreenshotPath ? `
      <div class="image-box">
        <div class="image-label">After Fix</div>
        <img src="${getWebPath(result.healingResults[0].verificationResult.verificationScreenshotPath)}" alt="Fixed Image">
      </div>
      ` : ''}
    </div>
    
    <div class="info-container">
      <div class="tabs">
        <div class="tab active" data-tab="overview-${result.name}">Overview</div>
        <div class="tab" data-tab="ai-analysis-${result.name}">AI Analysis</div>
        <div class="tab" data-tab="code-localization-${result.name}">Code Localization</div>
        <div class="tab" data-tab="recommendations-${result.name}">Recommendations</div>
        <div class="tab" data-tab="healing-${result.name}">Self-Healing</div>
      </div>
      
      <div class="tab-content active" id="overview-${result.name}">
        <p>Test result: <strong>${result.hasDifferences ? 'Differences Detected' : 'No Differences'}</strong></p>
        <p class="diff-info ${diffClass}">Difference: ${result.diffPercentage.toFixed(2)}% (${result.diffPixelCount} pixels)</p>
        <p>Threshold: ${result.threshold}</p>
        <p>Resolution: ${result.width}x${result.height}</p>
        <p>Page Name: ${result.name}</p>
        ${result.aiAnalysis?.isFalsePositive ? '<p><strong>Identified as a false positive by AI analysis</strong></p>' : ''}
        ${isHealed ? '<p><strong style="color: #1abc9c;">Issue automatically fixed by self-healing</strong></p>' : ''}
        ${isUnfixed ? '<p><strong style="color: #e74c3c;">Self-healing attempted but failed to fix the issue</strong></p>' : ''}
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
      
      <div class="tab-content" id="healing-${result.name}">
`;

    // Add self-healing results
    if (result.healingResults && result.healingResults.length > 0) {
      result.healingResults.forEach((hr, hrIndex) => {
        const healingClass = hr.status === 'success' ? 'healing-results healing-success' : 'healing-results healing-failure';
        const statusClass = hr.status === 'success' ? 'healing-status healing-success-status' : 'healing-status healing-failure-status';
        
        html += `
        <div class="${healingClass}">
          <h4>Fix Attempt ${hrIndex + 1}</h4>
          <p class="${statusClass}">Status: ${hr.status === 'success' ? 'Success' : 'Failed'}</p>
`;

        if (hr.status === 'failed' && hr.reason) {
          html += `
          <p><strong>Reason:</strong> ${hr.reason}</p>
`;
        }

        if (hr.status === 'success' && hr.fix) {
          html += `
          <h5>Applied Fix</h5>
          <p><strong>File:</strong> ${getRelativePath(hr.fix.filePath)}</p>
          <p><strong>Line:</strong> ${hr.fix.lineNumber}</p>
          
          <div class="before-after-container">
            <div class="before-after-box">
              <div class="before-after-header">Before</div>
              <div class="code-reference">${encodeHtml(hr.fix.currentContent)}</div>
            </div>
            
            <div class="before-after-box">
              <div class="before-after-header">After</div>
              <div class="code-reference">${encodeHtml(hr.fix.suggestedFix)}</div>
            </div>
          </div>
          
          <p><strong>Description:</strong> ${hr.fix.description}</p>
          <p><strong>Confidence:</strong> ${(hr.fix.confidence * 100).toFixed(0)}%</p>
`;

          if (hr.verificationResult) {
            html += `
          <h5>Verification Result</h5>
          <p><strong>Difference after fix:</strong> ${hr.verificationResult.diffPercentage.toFixed(2)}%</p>
          
          <div class="images-container">
            <div class="image-box">
              <div class="image-label">Before Fix</div>
              <img src="${getWebPath(result.currentImagePath)}" alt="Current Image">
            </div>
            
            <div class="image-box">
              <div class="image-label">After Fix</div>
              <img src="${getWebPath(hr.verificationResult.verificationScreenshotPath)}" alt="Fixed Image">
            </div>
            
            <div class="image-box">
              <div class="image-label">Verification Diff</div>
              <img src="${getWebPath(hr.verificationResult.diffImagePath)}" alt="Verification Diff Image">
            </div>
          </div>
`;
          }
        }

        html += `
        </div>
`;
      });
    } else {
      html += `
        <p>No self-healing attempted for this comparison.</p>
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
    <p>Generated by AI Visual Testing Phase 4 - Self-Healing Implementation</p>
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
 * Processes comparison results and registers issues for confirmation if needed
 * 
 * @param {Array} results - Visual comparison results
 * @param {Object} options - Workflow options
 * @returns {Promise<void>}
 */
async function processComparisonResults(results, options = {}) {
  logger.info(`Processing ${results.length} comparison results for potential user confirmation`);
  
  // Only process issues if not in baseline capture mode
  if (options.captureBaseline) {
    logger.info('Skipping user confirmation in baseline capture mode');
    return;
  }
  
  // Process each result
  for (const result of results) {
    // Skip results with no differences
    if (!result.hasDifferences) {
      continue;
    }
    
    logger.info(`Processing comparison result: ${result.name}`);
    
    // Check if user confirmation is required (depends on options)
    const requireConfirmation = options.requireUserConfirmation !== false;
    
    if (requireConfirmation) {
      // Register this issue for user confirmation
      try {
        const confirmationId = await intentConfirmationManager.registerPendingConfirmation(result);
        
        logger.info(`Registered issue for user confirmation with ID: ${confirmationId}`);
        // Set flag that confirmations are pending
        options.confirmationsPending = true;
      } catch (error) {
        logger.error(`Error registering issue for confirmation: ${error.message}`);
      }
    }
  }
}

/**
 * Updates the baseline image for an issue if the user confirms the change is intentional
 * 
 * @param {String} confirmationId - The ID of the confirmation
 * @returns {Promise<Boolean>} - Whether the baseline was updated
 */
async function updateBaselineForIntendedChange(confirmationId) {
  try {
    // Get the confirmation
    const confirmation = intentConfirmationManager.getProcessedConfirmation(confirmationId);
    
    if (!confirmation || !confirmation.isIntended) {
      return false;
    }
    
    // Get paths
    const currentImagePath = confirmation.issue.currentImagePath;
    const baselineImagePath = confirmation.issue.baselineImagePath;
    
    // Copy the current image to the baseline
    await fs.copyFile(currentImagePath, baselineImagePath);
    
    logger.info(`Updated baseline for ${confirmation.name} based on user confirmation`);
    
    return true;
  } catch (error) {
    logger.error(`Error updating baseline: ${error.message}`);
    return false;
  }
}

module.exports = {
  runSelfHealingWorkflow,
  generateEnhancedReport,
  ensureDiffImagesForReport,
  updateBaselineForIntendedChange,
  intentConfirmationManager
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
    dryRun: args.includes('--dry-run'),
    requireUserConfirmation: args.includes('--require-confirmation')
  };
  
  runSelfHealingWorkflow(options);
}
