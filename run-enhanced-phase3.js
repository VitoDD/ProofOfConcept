/**
 * run-enhanced-phase3.js
 * 
 * This script runs an enhanced version of Phase 3 with improved issue localization.
 * It addresses the issues of duplication and effectiveness in the standard Phase 3.
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Check if the enhanced issue localizer exists, otherwise create it
function ensureEnhancedLocalizerExists() {
  const enhancedLocalizerPath = path.join(__dirname, 'src', 'phase3', 'enhanced-issue-localizer.js');
  
  if (!fs.existsSync(enhancedLocalizerPath)) {
    console.error('❌ Enhanced issue localizer not found!');
    console.error('Please run the script to create the enhanced issue localizer first.');
    process.exit(1);
  }
}

// Modify the phase3-workflow.js to use the enhanced issue localizer
function modifyPhase3Workflow() {
  const workflowPath = path.join(__dirname, 'src', 'phase3', 'phase3-workflow.js');
  
  // Read the current workflow file
  let content = fs.readFileSync(workflowPath, 'utf8');
  
  // Check if it's already modified
  if (content.includes('EnhancedIssueLocalizer')) {
    console.log('✅ Phase 3 workflow already using the enhanced issue localizer');
    return;
  }
  
  // Add import for enhanced issue localizer
  content = content.replace(
    "const { IssueLocalizer } = require('./issue-localizer');", 
    "const { IssueLocalizer } = require('./issue-localizer');\nconst { EnhancedIssueLocalizer } = require('./enhanced-issue-localizer');"
  );
  
  // Replace issue localizer instantiation
  content = content.replace(
    "const issueLocalizer = new IssueLocalizer(uiCodeMapper, codebaseMap);",
    "const issueLocalizer = new EnhancedIssueLocalizer(uiCodeMapper, codebaseMap);"
  );
  
  // Write back the modified file
  fs.writeFileSync(workflowPath, content);
  console.log('✅ Modified Phase 3 workflow to use the enhanced issue localizer');
}

// Main function
async function main() {
  console.log('Setting up Enhanced Phase 3...');
  
  // Ensure the enhanced issue localizer exists
  ensureEnhancedLocalizerExists();
  
  // Modify the phase3-workflow.js
  modifyPhase3Workflow();
  
  console.log('Running Enhanced Phase 3...');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Add path to workflow file
  const workflowPath = path.join(__dirname, 'src', 'phase3', 'phase3-workflow.js');
  
  // Run the workflow
  const childProcess = spawn('node', [workflowPath, ...args], {
    stdio: 'inherit',
    shell: true
  });
  
  // Handle process exit
  childProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Enhanced Phase 3 completed successfully!');
      console.log('Reports are available in the reports directory.');
    } else {
      console.error(`\n❌ Enhanced Phase 3 failed with code ${code}`);
    }
    
    // Restore the original phase3-workflow.js (only for development/testing)
    // Uncomment this if you want to restore the original file after running
    // restoreOriginalWorkflow();
    
    process.exit(code);
  });
  
  // Handle errors
  childProcess.on('error', (err) => {
    console.error(`❌ Failed to start Enhanced Phase 3: ${err.message}`);
    process.exit(1);
  });
}

// Optional: Function to restore the original workflow file
function restoreOriginalWorkflow() {
  const workflowPath = path.join(__dirname, 'src', 'phase3', 'phase3-workflow.js');
  
  // Read the current workflow file
  let content = fs.readFileSync(workflowPath, 'utf8');
  
  // Remove enhanced issue localizer import
  content = content.replace(
    "\nconst { EnhancedIssueLocalizer } = require('./enhanced-issue-localizer');", 
    ""
  );
  
  // Restore original issue localizer instantiation
  content = content.replace(
    "const issueLocalizer = new EnhancedIssueLocalizer(uiCodeMapper, codebaseMap);",
    "const issueLocalizer = new IssueLocalizer(uiCodeMapper, codebaseMap);"
  );
  
  // Write back the modified file
  fs.writeFileSync(workflowPath, content);
  console.log('✅ Restored original Phase 3 workflow');
}

// Run the script
main().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
