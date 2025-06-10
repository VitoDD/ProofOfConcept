/**
 * ai-report.js
 * 
 * Generate enhanced reports with AI analysis of visual differences.
 */

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Report directory
const REPORTS_DIR = getConfig('comparison.outputDirectory', './reports');

/**
 * Generates an HTML report with AI analysis of visual differences
 * 
 * @param {Array} results - Array of comparison results with AI analysis
 * @returns {Promise<string>} - Path to the generated HTML report
 */
async function generateAiReport(results) {
  logger.info('Generating AI-enhanced visual testing report');
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportPath = path.join(REPORTS_DIR, `ai-visual-report-${timestamp}.html`);
  
  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  
  // Create HTML report
  const html = generateHtml(results, timestamp);
  
  // Write to file
  fs.writeFileSync(reportPath, html);
  
  logger.info(`AI-enhanced report generated: ${reportPath}`);
  
  return reportPath;
}

/**
 * Generates the HTML content for the report
 * 
 * @param {Array} results - Array of comparison results with AI analysis
 * @param {string} timestamp - Timestamp for the report
 * @returns {string} - HTML content
 */
function generateHtml(results, timestamp) {
  // Count significant differences (not false positives)
  const significantDiffs = results.filter(r => 
    r.aiAnalysis && 
    r.aiAnalysis.hasDifferences && 
    !(r.aiAnalysis.isFalsePositive || false)
  ).length;
  
  // Determine overall status
  const hasSignificantChanges = significantDiffs > 0;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Visual Testing Report - ${timestamp}</title>
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
    .ai-summary {
      background-color: #f0f7ff;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
      border-left: 4px solid #4a6cf7;
    }
    .comparison {
      margin-bottom: 40px;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .comparison.false-positive {
      opacity: 0.7;
      border-left: 4px solid #ffc107;
    }
    .comparison.significant {
      border-left: 4px solid #dc3545;
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
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .ai-analysis {
      background-color: #f0f7ff;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .ai-diagnosis {
      margin-top: 10px;
      font-size: 1.1em;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 15px 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
    }
    .badge.change-type {
      background-color: #e3f2fd;
      color: #0d47a1;
    }
    .badge.severity-LOW {
      background-color: #e8f5e9;
      color: #2e7d32;
    }
    .badge.severity-MEDIUM {
      background-color: #fff3e0;
      color: #ef6c00;
    }
    .badge.severity-HIGH {
      background-color: #ffebee;
      color: #c62828;
    }
    .badge.false-positive {
      background-color: #f3e5f5;
      color: #6a1b9a;
    }
    .badge.intentional {
      background-color: #e1f5fe;
      color: #0277bd;
    }
    .confidence {
      display: flex;
      align-items: center;
      margin-top: 10px;
    }
    .confidence-bar {
      flex-grow: 1;
      height: 8px;
      background-color: #eceff1;
      border-radius: 4px;
      margin: 0 10px;
      position: relative;
    }
    .confidence-level {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      border-radius: 4px;
      background-color: #4a6cf7;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 1em;
    }
    .status-badge.pass {
      background-color: #e8f5e9;
      color: #2e7d32;
    }
    .status-badge.fail {
      background-color: #ffebee;
      color: #c62828;
    }
    .element-list {
      margin-top: 10px;
    }
    .element-tag {
      display: inline-block;
      background-color: #e0e0e0;
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 6px;
      margin-bottom: 6px;
      font-size: 0.9em;
    }
    .details-toggle {
      cursor: pointer;
      color: #4a6cf7;
      margin-top: 10px;
      display: inline-block;
    }
    .raw-analysis {
      white-space: pre-wrap;
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin-top: 10px;
      display: none;
      max-height: 300px;
      overflow-y: auto;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>AI-Enhanced Visual Testing Report</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Total comparisons: <strong>${results.length}</strong></p>
    <p>Detected differences: <strong>${results.filter(r => r.diffPercentage > 0).length}</strong></p>
    <p>Significant changes: <strong>${significantDiffs}</strong></p>
    <p>False positives: <strong>${results.filter(r => r.aiAnalysis && r.aiAnalysis.isFalsePositive).length}</strong></p>
    <p>Status: 
      <span class="status-badge ${hasSignificantChanges ? 'fail' : 'pass'}">
        ${hasSignificantChanges ? 'SIGNIFICANT CHANGES DETECTED' : 'NO SIGNIFICANT CHANGES'}
      </span>
    </p>
  </div>
  
  <div class="ai-summary">
    <h2>AI Insights</h2>
    ${generateAiSummary(results)}
  </div>
  
  ${results.map(result => {
    const hasAiAnalysis = result.aiAnalysis && result.aiAnalysis.hasDifferences;
    const isFalsePositive = hasAiAnalysis && (result.aiAnalysis.isFalsePositive || false);
    const isSignificant = hasAiAnalysis && !isFalsePositive && result.diffPercentage > 0;
    
    return `
    <div class="comparison ${isFalsePositive ? 'false-positive' : ''} ${isSignificant ? 'significant' : ''}">
      <h2>Comparison: ${result.name}</h2>
      
      <div class="diff-details" style="background-color: ${result.diffPercentage > 0 ? '#fff8f8' : '#f8fff8'};">
        <p>Difference: 
          <strong style="color: ${
            result.diffPercentage > 5 ? '#dc3545' : 
            result.diffPercentage > 1 ? '#fd7e14' : 
            '#28a745'
          }">
            ${result.diffPercentage.toFixed(2)}% (${
              result.diffPixels ? result.diffPixels.toLocaleString() : 
              result.diffPixelCount ? result.diffPixelCount.toLocaleString() : 
              '0'
            } of ${
              result.totalPixels ? result.totalPixels.toLocaleString() : 
              '0'
            } pixels)
          </strong>
          ${isFalsePositive ? ' <span class="badge false-positive">FALSE POSITIVE</span>' : ''}
        </p>
      </div>
      
      ${hasAiAnalysis ? generateAiAnalysisHtml(result.aiAnalysis) : ''}
      
      <div class="images">
        <div class="image-container">
          <h3>Baseline</h3>
          <img src="${result.baselineImagePath}" alt="Baseline">
        </div>
        
        <div class="image-container">
          <h3>Current</h3>
          <img src="${result.currentImagePath}" alt="Current">
        </div>
        
        <div class="image-container">
          <h3>Differences</h3>
          <img src="${result.diffImagePath}" alt="Diff">
        </div>
      </div>
    </div>
    `;
  }).join('')}

  <script>
    // Toggle raw analysis display
    document.addEventListener('DOMContentLoaded', function() {
      const toggles = document.querySelectorAll('.details-toggle');
      toggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
          const targetId = this.getAttribute('data-target');
          const target = document.getElementById(targetId);
          if (target.style.display === 'none') {
            target.style.display = 'block';
            this.textContent = 'Hide raw analysis';
          } else {
            target.style.display = 'none';
            this.textContent = 'Show raw analysis';
          }
        });
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Generates an overall AI summary of all results
 * 
 * @param {Array} results - Array of comparison results with AI analysis
 * @returns {string} - HTML content for AI summary
 */
function generateAiSummary(results) {
  const significantChanges = results.filter(r => 
    r.aiAnalysis && 
    r.aiAnalysis.hasDifferences && 
    !(r.aiAnalysis.isFalsePositive || false) &&
    r.diffPercentage > 0
  );
  
  if (significantChanges.length === 0) {
    return `<p>AI analysis detected no significant visual changes. Any differences detected are likely false positives 
    or minor changes that don't affect the user experience.</p>`;
  }
  
  // Collect change types
  const changeTypes = {};
  significantChanges.forEach(result => {
    const type = result.aiAnalysis.changeType || 'UNKNOWN';
    if (!changeTypes[type]) {
      changeTypes[type] = [];
    }
    changeTypes[type].push(result);
  });
  
  // Generate summary
  let summary = `<p>AI analysis detected ${significantChanges.length} significant visual changes:</p><ul>`;
  
  for (const [type, changes] of Object.entries(changeTypes)) {
    summary += `<li><strong>${type}</strong>: ${changes.length} changes`;
    
    // Add example if available
    if (changes.length > 0 && changes[0].aiAnalysis.summary) {
      summary += ` (e.g., "${changes[0].aiAnalysis.summary}")`;
    }
    
    summary += '</li>';
  }
  
  summary += '</ul>';
  
  // Add recommendation
  if (significantChanges.length > 0) {
    const highSeverity = significantChanges.filter(r => r.aiAnalysis.severity === 'HIGH').length;
    
    if (highSeverity > 0) {
      summary += `<p><strong>Recommendation:</strong> Review the ${highSeverity} high-severity changes as they likely 
      represent significant UI issues that could affect users.</p>`;
    } else {
      summary += `<p><strong>Recommendation:</strong> These changes appear to be intentional UI updates. 
      If they were expected, consider updating your baseline screenshots.</p>`;
    }
  }
  
  return summary;
}

/**
 * Generates HTML for AI analysis section
 * 
 * @param {Object} aiAnalysis - AI analysis object
 * @returns {string} - HTML content for AI analysis
 */
function generateAiAnalysisHtml(aiAnalysis) {
  if (!aiAnalysis || !aiAnalysis.hasDifferences) {
    return '';
  }
  
  // Extract data from analysis
  const {
    changeType = 'UNKNOWN',
    severity = 'LOW',
    affectedElements = [],
    intentional = false,
    confidence = 0.5,
    summary = 'No summary available',
    description = 'No description available',
    rawAnalysis = '',
    meetsConfidenceThreshold = false,
    isFalsePositive = false
  } = aiAnalysis;
  
  // Format the raw analysis with proper paragraphs
  const formattedAnalysis = rawAnalysis
    .split('\n')
    .filter(para => para.trim() !== '')
    .map(para => `<p>${para}</p>`)
    .join('');
  
  // Generate unique ID for raw analysis
  const analysisId = `analysis-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  return `
  <div class="ai-analysis">
    <h3>AI Analysis</h3>
    
    <div class="ai-diagnosis">
      <p>${summary}</p>
    </div>
    
    <div class="badges">
      <span class="badge change-type">${changeType}</span>
      <span class="badge severity-${severity}">${severity} SEVERITY</span>
      ${intentional ? '<span class="badge intentional">INTENTIONAL</span>' : ''}
      ${isFalsePositive ? '<span class="badge false-positive">FALSE POSITIVE</span>' : ''}
    </div>
    
    ${affectedElements.length > 0 ? `
    <div class="element-list">
      <strong>Affected elements:</strong>
      ${affectedElements.map(el => `<span class="element-tag">${el}</span>`).join('')}
    </div>
    ` : ''}
    
    <div class="confidence">
      <span>Confidence:</span>
      <div class="confidence-bar">
        <div class="confidence-level" style="width: ${confidence * 100}%"></div>
      </div>
      <span>${Math.round(confidence * 100)}%</span>
    </div>
    
    <div class="analysis-content">
      ${formattedAnalysis || `<p>${description}</p>`}
    </div>
    
    <div class="details-toggle" data-target="${analysisId}">Show raw analysis</div>
    <div id="${analysisId}" class="raw-analysis">${rawAnalysis}</div>
  </div>
  `;
}

// Export functions
module.exports = {
  generateAiReport
};
