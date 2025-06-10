/**
 * create-visual-bug.js
 * 
 * Utility for introducing visual bugs into the test application.
 * This script modifies CSS properties to create visual differences for testing.
 */

const fs = require('fs');
const path = require('path');

// Path to CSS file
const CSS_FILE_PATH = path.join(__dirname, '../../public/styles.css');

/**
 * Introduces a visual bug by modifying CSS properties
 * 
 * @param {string} bugType - Type of visual bug to introduce
 * @returns {Object} - Information about the introduced bug
 */
function introduceVisualBug(bugType = 'color') {
  // Read CSS file
  const cssContent = fs.readFileSync(CSS_FILE_PATH, 'utf8');
  
  let modifiedCss;
  let bugDescription;
  
  switch (bugType) {
    case 'color':
      // Change the button primary color
      modifiedCss = cssContent.replace(
        'background-color: #3498db;',
        'background-color: #e74c3c;'
      );
      bugDescription = 'Changed button primary color from blue to red';
      break;
      
    case 'layout':
      // Change the card padding
      modifiedCss = cssContent.replace(
        'padding: 20px;',
        'padding: 40px;'
      );
      bugDescription = 'Changed card padding from 20px to 40px';
      break;
      
    case 'spacing':
      // Change margin between form groups
      modifiedCss = cssContent.replace(
        'margin-bottom: 15px;',
        'margin-bottom: 30px;'
      );
      bugDescription = 'Increased form group spacing from 15px to 30px';
      break;
      
    case 'font':
      // Change form font size
      modifiedCss = cssContent.replace(
        'font-size: 16px;',
        'font-size: 20px;'
      );
      bugDescription = 'Increased form font size from 16px to 20px';
      break;
      
    case 'button':
      // Change button style
      modifiedCss = cssContent.replace(
        'border-radius: 4px;',
        'border-radius: 20px;'
      );
      bugDescription = 'Changed button border-radius from 4px to 20px';
      break;
      
    default:
      throw new Error(`Unknown bug type: ${bugType}`);
  }
  
  // Write modified CSS back to file
  fs.writeFileSync(CSS_FILE_PATH, modifiedCss);
  
  console.log(`Visual bug introduced: ${bugDescription}`);
  
  return {
    type: bugType,
    description: bugDescription,
    file: CSS_FILE_PATH
  };
}

/**
 * Reverts all visual bugs by restoring the original CSS
 */
function revertVisualBugs() {
  // Path to original CSS file (stored in the repo)
  const originalCssPath = path.join(__dirname, '../../src/phase1/original-styles.css');
  
  // Check if original CSS file exists
  if (!fs.existsSync(originalCssPath)) {
    console.error('Original CSS file not found. Cannot revert changes.');
    return false;
  }
  
  // Read original CSS file
  const originalCss = fs.readFileSync(originalCssPath, 'utf8');
  
  // Write original CSS back to application file
  fs.writeFileSync(CSS_FILE_PATH, originalCss);
  
  console.log('All visual bugs reverted. CSS restored to original state.');
  
  return true;
}

// Export functions
module.exports = {
  introduceVisualBug,
  revertVisualBugs
};

// If this script is run directly, introduce a visual bug
if (require.main === module) {
  // Check for command line args
  const args = process.argv.slice(2);
  
  if (args.includes('--revert')) {
    revertVisualBugs();
  } else {
    const bugType = args[0] || 'color';
    introduceVisualBug(bugType);
  }
}
