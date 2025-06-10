/**
 * one-step-bug.js
 * 
 * A comprehensive script that does everything needed in one go:
 * 1. Restores original CSS
 * 2. Captures baseline screenshots
 * 3. Introduces dramatic visual changes
 * 4. Captures current screenshots
 * 5. Performs comparison
 * 6. Fixes diff images
 * 7. Runs Phase 3 analysis
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path constants
const CSS_FILE_PATH = path.join(__dirname, 'public', 'styles.css');
const ORIGINAL_CSS_PATH = path.join(__dirname, 'src', 'phase1', 'original-styles.css');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORTS_DIR = path.join(__dirname, 'reports');

// Ensure directories exist
for (const dir of [SCREENSHOTS_DIR, REPORTS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Set up subdirectories
for (const subdir of ['baseline', 'current', 'diff']) {
  const dir = path.join(SCREENSHOTS_DIR, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  } else {
    // Clean existing files
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.png')) {
          fs.unlinkSync(path.join(dir, file));
        }
      }
    } catch (err) {
      console.error(`Error cleaning ${dir}: ${err.message}`);
    }
  }
}

// Function to safely run commands
function runCommand(command) {
  console.log(`\nRunning: ${command}`);
  try {
    const output = execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    return false;
  }
}

// Function to restore original CSS
function restoreOriginalCSS() {
  console.log('\n1. Restoring original CSS...');
  try {
    const originalCss = fs.readFileSync(ORIGINAL_CSS_PATH, 'utf8');
    fs.writeFileSync(CSS_FILE_PATH, originalCss);
    console.log('✅ Original CSS restored.');
    return true;
  } catch (error) {
    console.error(`❌ Failed to restore original CSS: ${error.message}`);
    return false;
  }
}

// Function to introduce visual bug
function introduceVisualBug() {
  console.log('\n3. Introducing visual bug...');
  try {
    // Read the current CSS
    let cssContent = fs.readFileSync(CSS_FILE_PATH, 'utf8');
    
    // Define dramatic visual changes
    const changes = [
      // Change all buttons to have bright red background
      {
        from: '.btn-primary {\n    background-color: #3498db;',
        to: '.btn-primary {\n    background-color: #ff0000;'
      },
      // Make buttons round
      {
        from: 'border-radius: 4px;',
        to: 'border-radius: 25px;'
      },
      // Increase card padding
      {
        from: 'padding: 20px;',
        to: 'padding: 40px;'
      },
      // Change page background color
      {
        from: 'background-color: #f8f9fa;',
        to: 'background-color: #e0f7fa;'
      },
      // Add color border to cards
      {
        from: 'box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);',
        to: 'box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); border: 3px solid #ff9800;'
      },
      // Change text color
      {
        from: 'color: #333;',
        to: 'color: #9c27b0;'
      },
      // Change font
      {
        from: 'font-family: \'Arial\', sans-serif;',
        to: 'font-family: \'Courier New\', monospace;'
      },
      // Increase all font sizes
      {
        from: 'font-size: 16px;',
        to: 'font-size: 20px;'
      }
    ];
    
    // Apply changes
    for (const change of changes) {
      cssContent = cssContent.replace(change.from, change.to);
    }
    
    // Write the modified CSS back
    fs.writeFileSync(CSS_FILE_PATH, cssContent);
    
    console.log('✅ Visual bug introduced with these changes:');
    changes.forEach((change, index) => {
      console.log(`   ${index + 1}. Changed "${change.from.split('\n')[0]}..." to "${change.to.split('\n')[0]}..."`);
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to introduce visual bug: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting One-Step Bug Creation and Analysis');
  console.log('==============================================');
  
  // Step 1: Restore original CSS
  if (!restoreOriginalCSS()) {
    console.error('❌ Failed to restore original CSS. Aborting.');
    return;
  }
  
  // Step 2: Capture baseline screenshots
  console.log('\n2. Capturing baseline screenshots...');
  if (!runCommand('node src/phase1/screenshot.js --baseline')) {
    console.error('❌ Failed to capture baseline screenshots. Aborting.');
    return;
  }
  
  // Step 3: Introduce visual bug
  if (!introduceVisualBug()) {
    console.error('❌ Failed to introduce visual bug. Aborting.');
    return;
  }
  
  // Step 4: Capture current screenshots
  console.log('\n4. Capturing current screenshots...');
  if (!runCommand('node src/phase1/screenshot.js --current')) {
    console.error('❌ Failed to capture current screenshots. Aborting.');
    return;
  }
  
  // Step 5: Perform comparison
  console.log('\n5. Comparing screenshots...');
  
  // Find the most recent current directory
  const currentDirs = fs.readdirSync(path.join(SCREENSHOTS_DIR, 'current'))
                        .filter(dir => !dir.startsWith('.'))
                        .sort()
                        .reverse();
  
  if (currentDirs.length === 0) {
    console.error('❌ No current screenshot directories found. Aborting.');
    return;
  }
  
  console.log(`Using current directory: screenshots/current/${currentDirs[0]}`);
  
  if (!runCommand('node src/phase1/compare.js')) {
    console.error('❌ Failed to compare screenshots. Aborting.');
    return;
  }
  
  // Step 6: Fix diff images
  console.log('\n6. Fixing diff images...');
  if (!runCommand('node fix-diff-images.js')) {
    console.error('❌ Failed to fix diff images. Continuing anyway...');
    // Continue despite error
  }
  
  // Step 7: Run Phase 3 analysis
  console.log('\n7. Running Phase 3 analysis...');
  if (!runCommand('node run-phase3.js --force')) {
    console.error('❌ Failed to run Phase 3 analysis.');
    return;
  }
  
  console.log('\n✅ Done! Check the reports directory for the latest Phase 3 report.');
  console.log('The latest report will have a name like "phase3-report-[timestamp].html"');
  
  // Try to open the reports directory
  try {
    console.log('\nOpening reports directory...');
    if (process.platform === 'win32') {
      execSync('start ' + REPORTS_DIR);
    } else if (process.platform === 'darwin') {
      execSync('open ' + REPORTS_DIR);
    } else {
      execSync('xdg-open ' + REPORTS_DIR);
    }
  } catch (error) {
    console.log(`Could not open reports directory: ${error.message}`);
    console.log(`Please open it manually at: ${REPORTS_DIR}`);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unexpected error:', error);
});
