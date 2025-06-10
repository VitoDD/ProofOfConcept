/**
 * Phase 3 Runner (Enhanced by default)
 * 
 * This script serves as a simplified entry point for running Phase 3 (Code Analysis & Issue Localization)
 * Now using the enhanced issue localizer by default for better results
 */

const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);

// Check if user wants to use the original localizer instead
const useOriginal = args.includes('--use-original');
if (useOriginal) {
  // Remove the flag so it doesn't get passed to the workflow
  const flagIndex = args.indexOf('--use-original');
  args.splice(flagIndex, 1);
}

// Add path to workflow file
const workflowPath = path.join(__dirname, 'src', 'phase3', 'phase3-workflow.js');

console.log(`Running Phase 3: Code Analysis & Issue Localization${useOriginal ? '' : ' (Enhanced)'}`);
console.log('-'.repeat(40));

// Check if the enhanced issue localizer exists
const enhancedLocalizerPath = path.join(__dirname, 'src', 'phase3', 'enhanced-issue-localizer.js');
const enhancedLocalizerExists = fs.existsSync(enhancedLocalizerPath);

if (!enhancedLocalizerExists && !useOriginal) {
  console.warn('⚠️ Enhanced issue localizer not found. Falling back to original implementation.');
  console.warn('To use the enhanced version, please run the setup script first.');
} else if (!useOriginal && enhancedLocalizerExists) {
  // Modify the workflow to use the enhanced issue localizer
  modifyWorkflow();
}

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

// Modify the workflow to use the enhanced issue localizer
function modifyWorkflow() {
  try {
    // Read the current workflow file
    let content = fs.readFileSync(workflowPath, 'utf8');
    
    // Check if it's already modified
    if (content.includes('EnhancedIssueLocalizer')) {
      console.log('ℹ️ Workflow already using the enhanced issue localizer');
      return;
    }
    
    // Create a backup of the original file if it doesn't exist
    const backupPath = workflowPath + '.backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content);
      console.log('ℹ️ Created backup of original workflow file');
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
    console.log('ℹ️ Modified workflow to use the enhanced issue localizer');
  } catch (error) {
    console.error(`❌ Error modifying workflow: ${error.message}`);
    console.log('Continuing with original implementation...');
  }
}

// Restore the original workflow file
function restoreWorkflow() {
  try {
    const backupPath = workflowPath + '.backup';
    
    // Check if backup exists
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(workflowPath, content);
      console.log('ℹ️ Restored original workflow file');
    } else {
      console.warn('⚠️ No backup file found, cannot restore workflow');
      
      // Try to manually restore
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
      console.log('ℹ️ Manually restored original workflow');
    }
  } catch (error) {
    console.error(`❌ Error restoring workflow: ${error.message}`);
  }
}

// Run the Phase 3 workflow
function runWorkflow(args) {
  // Spawn the Phase 3 workflow process
  const childProcess = spawn('node', [workflowPath, ...args], {
    stdio: 'inherit',
    shell: true
  });

  // Handle process exit
  childProcess.on('close', (code) => {
    // Restore the original workflow if we modified it
    if (!useOriginal && enhancedLocalizerExists) {
      restoreWorkflow();
    }
    
    if (code === 0) {
      console.log('\n✅ Phase 3 completed successfully!');
      console.log('Reports are available in the reports directory.');
    } else {
      console.error(`\n❌ Phase 3 failed with code ${code}`);
    }
    process.exit(code);
  });

  // Handle errors
  childProcess.on('error', (err) => {
    // Restore the original workflow if we modified it
    if (!useOriginal && enhancedLocalizerExists) {
      restoreWorkflow();
    }
    
    console.error(`❌ Failed to start Phase 3 workflow: ${err.message}`);
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
