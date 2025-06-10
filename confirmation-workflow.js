/**
 * confirmation-workflow.js
 * 
 * A simplified workflow for handling user confirmations of visual changes
 * Designed to work well with GitHub Actions
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./src/utils/logger');

// Enable file logging
logger.enableFileLogging('confirmation-workflow.log');

/**
 * Main function to handle the confirmation workflow
 */
async function handleConfirmations() {
  try {
    // Define paths
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const reportsDir = path.join(process.cwd(), 'reports');
    const confirmationsDir = path.join(reportsDir, 'confirmations');
    
    // Ensure directories exist
    await fs.mkdir(screenshotsDir, { recursive: true });
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.mkdir(confirmationsDir, { recursive: true });
    
    // Create confirmation data storage file if it doesn't exist
    const confirmationsFile = path.join(confirmationsDir, 'confirmations.json');
    
    let confirmations = {
      pending: [],
      processed: []
    };
    
    try {
      const data = await fs.readFile(confirmationsFile, 'utf8');
      confirmations = JSON.parse(data);
      console.log(`Loaded ${confirmations.pending.length} pending and ${confirmations.processed.length} processed confirmations`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: ${error.message}`);
      }
      console.log('No existing confirmations found, starting with empty data');
    }
    
    // Check if there are any command-line arguments
    const args = process.argv.slice(2);
    
    // Check for approve/reject commands
    if (args.includes('--approve') || args.includes('--reject')) {
      // Get the ID from arguments
      const idArg = args.find(arg => arg.startsWith('--id='));
      if (!idArg) {
        console.error('Error: You must provide an ID with --id=<confirmation-id>');
        process.exit(1);
      }
      
      const id = idArg.split('=')[1];
      const isApproved = args.includes('--approve');
      
      // Find the pending confirmation
      const pendingIndex = confirmations.pending.findIndex(c => c.id === id);
      
      if (pendingIndex === -1) {
        console.error(`Error: No pending confirmation found with ID: ${id}`);
        process.exit(1);
      }
      
      // Process the confirmation
      const confirmation = confirmations.pending[pendingIndex];
      confirmation.processedAt = Date.now();
      confirmation.approved = isApproved;
      
      // Move it to processed
      confirmations.processed.push(confirmation);
      confirmations.pending.splice(pendingIndex, 1);
      
      // Update the file
      await fs.writeFile(confirmationsFile, JSON.stringify(confirmations, null, 2), 'utf8');
      console.log(`Confirmation ${id} has been ${isApproved ? 'approved' : 'rejected'}`);
      
      // If approved, update the baseline
      if (isApproved) {
        await updateBaseline(confirmation);
      }
      
      process.exit(0);
    }
    
    // Check if we need to generate a new report
    if (args.includes('--generate-report')) {
      await generateConfirmationReport(confirmations, confirmationsDir);
      process.exit(0);
    }
    
    // Check for register new confirmations
    if (args.includes('--register')) {
      // Get comparison results
      const comparisonFiles = await findComparisonFiles(reportsDir);
      
      if (comparisonFiles.length === 0) {
        console.log('No comparison results found to register');
        process.exit(0);
      }
      
      // Process each file
      let newConfirmations = 0;
      
      for (const file of comparisonFiles) {
        try {
          const data = await fs.readFile(file, 'utf8');
          const results = JSON.parse(data);
          
          if (!Array.isArray(results)) {
            console.warn(`Warning: ${file} doesn't contain an array of results`);
            continue;
          }
          
          // Filter for results with differences
          const withDifferences = results.filter(r => r.hasDifferences);
          
          for (const result of withDifferences) {
            // Check if this result is already registered
            const existingPending = confirmations.pending.find(c => c.name === result.name);
            const existingProcessed = confirmations.processed.find(c => c.name === result.name);
            
            if (existingPending || existingProcessed) {
              console.log(`Result ${result.name} is already registered`);
              continue;
            }
            
            // Create a new confirmation
            const confirmation = {
              id: `${result.name}-${Date.now()}`,
              name: result.name,
              createdAt: Date.now(),
              baselineImage: result.baselineImagePath,
              currentImage: result.currentImagePath,
              diffImage: result.diffImagePath,
              diffPercentage: result.diffPercentage,
              diffPixelCount: result.diffPixelCount
            };
            
            // Copy images to confirmations directory
            await copyImagesToConfirmationsDir(confirmation, screenshotsDir, confirmationsDir);
            
            // Add to pending confirmations
            confirmations.pending.push(confirmation);
            newConfirmations++;
          }
        } catch (error) {
          console.warn(`Warning: Failed to process ${file}: ${error.message}`);
        }
      }
      
      // Save the confirmations
      await fs.writeFile(confirmationsFile, JSON.stringify(confirmations, null, 2), 'utf8');
      console.log(`Registered ${newConfirmations} new confirmations`);
      
      // Generate a new report
      await generateConfirmationReport(confirmations, confirmationsDir);
      process.exit(0);
    }
    
    // By default, just show usage
    showUsage();
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Find all comparison result files
 */
async function findComparisonFiles(reportsDir) {
  try {
    const files = await fs.readdir(reportsDir);
    return files
      .filter(file => file.startsWith('comparison-report-') && file.endsWith('.json'))
      .map(file => path.join(reportsDir, file));
  } catch (error) {
    console.warn(`Warning: Failed to read reports directory: ${error.message}`);
    return [];
  }
}

/**
 * Copy images to the confirmations directory
 */
async function copyImagesToConfirmationsDir(confirmation, screenshotsDir, confirmationsDir) {
  // Create directories for images
  const imagesDir = path.join(confirmationsDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });
  
  // Helper function to copy an image
  async function copyImage(sourcePath, targetName) {
    try {
      // Resolve the source path
      let resolvedSourcePath = sourcePath;
      
      // If it's just a filename, try to find it in the screenshots directory
      if (!sourcePath.includes(path.sep)) {
        // Try different subdirectories
        const possibleDirs = ['baseline', 'current', 'diff'];
        for (const dir of possibleDirs) {
          const possiblePath = path.join(screenshotsDir, dir, sourcePath);
          try {
            await fs.access(possiblePath);
            resolvedSourcePath = possiblePath;
            break;
          } catch (e) {
            // File not found in this directory
          }
        }
      }
      
      // The target path
      const targetPath = path.join(imagesDir, targetName);
      
      // Copy the file
      await fs.copyFile(resolvedSourcePath, targetPath);
      
      // Return the relative path for storing in the confirmation
      return `images/${targetName}`;
    } catch (error) {
      console.warn(`Warning: Failed to copy image ${sourcePath}: ${error.message}`);
      return null;
    }
  }
  
  // Copy each image
  confirmation.baselineImagePath = await copyImage(
    confirmation.baselineImage,
    `baseline-${confirmation.id}.png`
  ) || confirmation.baselineImage;
  
  confirmation.currentImagePath = await copyImage(
    confirmation.currentImage,
    `current-${confirmation.id}.png`
  ) || confirmation.currentImage;
  
  confirmation.diffImagePath = await copyImage(
    confirmation.diffImage,
    `diff-${confirmation.id}.png`
  ) || confirmation.diffImage;
}

/**
 * Update the baseline with the current image
 */
async function updateBaseline(confirmation) {
  try {
    console.log(`Updating baseline for ${confirmation.name}...`);
    
    // Get the paths
    const baselinePath = confirmation.baselineImage;
    const currentPath = confirmation.currentImage;
    
    // If paths are just filenames, we need to resolve them
    let fullBaselinePath = baselinePath;
    let fullCurrentPath = currentPath;
    
    if (!baselinePath.includes(path.sep)) {
      fullBaselinePath = path.join(process.cwd(), 'screenshots', 'baseline', baselinePath);
    }
    
    if (!currentPath.includes(path.sep)) {
      fullCurrentPath = path.join(process.cwd(), 'screenshots', 'current', currentPath);
    }
    
    // Check if the current image exists
    try {
      await fs.access(fullCurrentPath);
    } catch (error) {
      // Try to use the copy in the confirmations directory
      const confirmationsDir = path.join(process.cwd(), 'reports', 'confirmations');
      
      if (confirmation.currentImagePath && confirmation.currentImagePath.startsWith('images/')) {
        fullCurrentPath = path.join(confirmationsDir, confirmation.currentImagePath);
      } else {
        throw new Error(`Current image not found: ${fullCurrentPath}`);
      }
    }
    
    // Ensure the baseline directory exists
    const baselineDir = path.dirname(fullBaselinePath);
    await fs.mkdir(baselineDir, { recursive: true });
    
    // Copy the current image to replace the baseline
    await fs.copyFile(fullCurrentPath, fullBaselinePath);
    
    console.log(`Baseline updated: ${fullBaselinePath}`);
    return true;
  } catch (error) {
    console.error(`Error updating baseline: ${error.message}`);
    return false;
  }
}

/**
 * Generate a confirmation report
 */
async function generateConfirmationReport(confirmations, confirmationsDir) {
  console.log('Generating confirmation report...');
  
  // Create HTML report
  const reportPath = path.join(confirmationsDir, 'index.html');
  
  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Testing Confirmations</title>
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
      color: #0366d6;
    }
    .card {
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .card-header {
      background-color: #f6f8fa;
      padding: 15px;
      border-bottom: 1px solid #e1e4e8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-body {
      padding: 15px;
    }
    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .image-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .image-container img {
      max-width: 100%;
      border: 1px solid #e1e4e8;
      border-radius: 3px;
    }
    .image-caption {
      margin-top: 8px;
      font-weight: bold;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
      color: white;
    }
    .badge-pending {
      background-color: #0366d6;
    }
    .badge-approved {
      background-color: #28a745;
    }
    .badge-rejected {
      background-color: #d73a49;
    }
    .stats {
      display: flex;
      justify-content: space-between;
      background-color: #f6f8fa;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .stat-card {
      text-align: center;
      padding: 10px;
      flex: 1;
      border-right: 1px solid #e1e4e8;
    }
    .stat-card:last-child {
      border-right: none;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #0366d6;
    }
    .stat-label {
      font-size: 14px;
      color: #586069;
    }
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .button {
      display: inline-block;
      padding: 8px 16px;
      font-size: 14px;
      border-radius: 6px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      text-align: center;
      border: 1px solid transparent;
    }
    .button-approve {
      background-color: #28a745;
      color: white;
    }
    .button-reject {
      background-color: #d73a49;
      color: white;
    }
    .button-disabled {
      background-color: #f6f8fa;
      color: #959da5;
      cursor: not-allowed;
      border: 1px solid #e1e4e8;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid #e1e4e8;
      margin-bottom: 20px;
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }
    .tab.active {
      border-bottom-color: #0366d6;
      font-weight: 500;
    }
    pre {
      background-color: #f6f8fa;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
    }
    code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 12px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #586069;
    }
    /* Tooltip styles */
    .tooltip {
      position: relative;
      display: inline-block;
    }
    .tooltip .tooltip-text {
      visibility: hidden;
      width: 350px;
      background-color: #24292e;
      color: #fff;
      text-align: center;
      border-radius: 6px;
      padding: 10px;
      position: absolute;
      z-index: 1;
      bottom: 125%;
      left: 50%;
      transform: translateX(-50%);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .tooltip:hover .tooltip-text {
      visibility: visible;
      opacity: 1;
    }
  </style>
</head>
<body>
  <h1>Visual Testing Confirmations</h1>
  
  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${confirmations.pending.length}</div>
      <div class="stat-label">Pending</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${confirmations.processed.filter(c => c.approved).length}</div>
      <div class="stat-label">Approved</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${confirmations.processed.filter(c => !c.approved).length}</div>
      <div class="stat-label">Rejected</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${confirmations.pending.length + confirmations.processed.length}</div>
      <div class="stat-label">Total</div>
    </div>
  </div>
  
  <div class="tabs">
    <div class="tab active" onclick="showTab('pending')">Pending Confirmations</div>
    <div class="tab" onclick="showTab('processed')">Processed Confirmations</div>
    <div class="tab" onclick="showTab('help')">Help</div>
  </div>
  
  <div id="pending" class="tab-content">
    ${confirmations.pending.length === 0 ? 
      '<div class="empty-state">No pending confirmations found.</div>' : 
      confirmations.pending.map(confirmation => `
        <div class="card">
          <div class="card-header">
            <h3>${confirmation.name}</h3>
            <span class="badge badge-pending">Pending</span>
          </div>
          <div class="card-body">
            <p>Created: ${new Date(confirmation.createdAt).toLocaleString()}</p>
            <p>Difference: ${confirmation.diffPercentage ? confirmation.diffPercentage.toFixed(2) + '%' : 'N/A'} (${confirmation.diffPixelCount || 0} pixels)</p>
            
            <div class="image-grid">
              <div class="image-container">
                <img src="${confirmation.baselineImagePath}" alt="Baseline" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; this.style.background='#f6f8fa'; this.style.padding='50px'; this.style.color='#586069';">
                <div class="image-caption">Baseline</div>
              </div>
              
              <div class="image-container">
                <img src="${confirmation.currentImagePath}" alt="Current" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; this.style.background='#f6f8fa'; this.style.padding='50px'; this.style.color='#586069';">
                <div class="image-caption">Current</div>
              </div>
              
              <div class="image-container">
                <img src="${confirmation.diffImagePath}" alt="Diff" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; this.style.background='#f6f8fa'; this.style.padding='50px'; this.style.color='#586069';">
                <div class="image-caption">Difference</div>
              </div>
            </div>
            
            <div class="button-group">
              <div class="tooltip">
                <pre><code>npm run confirm -- --approve --id=${confirmation.id}</code></pre>
                <span class="tooltip-text">Run this command to approve this change and update the baseline.</span>
              </div>
              
              <div class="tooltip">
                <pre><code>npm run confirm -- --reject --id=${confirmation.id}</code></pre>
                <span class="tooltip-text">Run this command to reject this change and keep the original baseline.</span>
              </div>
            </div>
          </div>
        </div>
      `).join('')
    }
  </div>
  
  <div id="processed" class="tab-content" style="display: none;">
    ${confirmations.processed.length === 0 ? 
      '<div class="empty-state">No processed confirmations found.</div>' : 
      confirmations.processed.map(confirmation => `
        <div class="card">
          <div class="card-header">
            <h3>${confirmation.name}</h3>
            <span class="badge badge-${confirmation.approved ? 'approved' : 'rejected'}">${confirmation.approved ? 'Approved' : 'Rejected'}</span>
          </div>
          <div class="card-body">
            <p>Processed: ${new Date(confirmation.processedAt).toLocaleString()}</p>
            <p>Difference: ${confirmation.diffPercentage ? confirmation.diffPercentage.toFixed(2) + '%' : 'N/A'} (${confirmation.diffPixelCount || 0} pixels)</p>
            
            <div class="image-grid">
              <div class="image-container">
                <img src="${confirmation.baselineImagePath}" alt="Baseline" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; this.style.background='#f6f8fa'; this.style.padding='50px'; this.style.color='#586069';">
                <div class="image-caption">Baseline</div>
              </div>
              
              <div class="image-container">
                <img src="${confirmation.currentImagePath}" alt="Current" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; this.style.background='#f6f8fa'; this.style.padding='50px'; this.style.color='#586069';">
                <div class="image-caption">Current</div>
              </div>
              
              <div class="image-container">
                <img src="${confirmation.diffImagePath}" alt="Diff" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; this.style.background='#f6f8fa'; this.style.padding='50px'; this.style.color='#586069';">
                <div class="image-caption">Difference</div>
              </div>
            </div>
          </div>
        </div>
      `).join('')
    }
  </div>
  
  <div id="help" class="tab-content" style="display: none;">
    <div class="card">
      <div class="card-header">
        <h3>How to Use This System</h3>
      </div>
      <div class="card-body">
        <h4>Viewing Confirmations</h4>
        <p>This page shows visual differences that need confirmation. The "Pending Confirmations" tab shows changes that haven't been approved or rejected yet.</p>
        
        <h4>Approving or Rejecting Changes</h4>
        <p>To approve a change, use the command shown under each pending confirmation. This will update the baseline image with the current version.</p>
        <p>To reject a change, use the reject command. This will keep the original baseline image.</p>
        
        <h4>Command Line Usage</h4>
        <pre><code>npm run confirm -- --register               # Register new confirmations from comparison reports
npm run confirm -- --approve --id=ID        # Approve a confirmation
npm run confirm -- --reject --id=ID         # Reject a confirmation
npm run confirm -- --generate-report        # Generate a new confirmation report</code></pre>
        
        <h4>In CI/CD Environments</h4>
        <p>In GitHub Actions, confirmations can be processed automatically or manually through workflow dispatch events.</p>
      </div>
    </div>
  </div>
  
  <script>
    function showTab(tabId) {
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      // Show the selected tab content
      document.getElementById(tabId).style.display = 'block';
      
      // Update active tab
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Find tab by its onclick attribute
      document.querySelector(`.tab[onclick*="${tabId}"]`).classList.add('active');
    }
  </script>
</body>
</html>
  `;
  
  // Write the HTML report
  await fs.writeFile(reportPath, html, 'utf8');
  
  console.log(`Report generated: ${reportPath}`);
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
Visual Testing Confirmation Workflow

Usage:
  npm run confirm -- --register               # Register new confirmations from comparison reports
  npm run confirm -- --approve --id=ID        # Approve a confirmation
  npm run confirm -- --reject --id=ID         # Reject a confirmation
  npm run confirm -- --generate-report        # Generate a new confirmation report

Examples:
  npm run confirm -- --register
  npm run confirm -- --approve --id=header-1621234567890
  npm run confirm -- --reject --id=footer-1621234567890
  `);
}

// Run the main function if this script is called directly
if (require.main === module) {
  handleConfirmations().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  handleConfirmations,
  updateBaseline,
  generateConfirmationReport
};
