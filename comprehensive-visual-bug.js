/**
 * comprehensive-visual-bug.js
 * 
 * Creates multiple visual bugs simultaneously for testing LLaVA-2 detection capabilities:
 * - Text truncation: Truncates text that should be fully visible
 * - Missing elements: Hides buttons or UI components
 * - Color contrast issues: Changes colors to create poor contrast
 * - Layout shifts: Moves elements out of alignment
 */

const fs = require('fs');
const path = require('path');

// Path to CSS and HTML files
const CSS_FILE_PATH = path.join(__dirname, 'public/styles.css');
const HTML_FILE_PATH = path.join(__dirname, 'public/index.html');
const ORIGINAL_CSS_PATH = path.join(__dirname, 'src/phase1/original-styles.css');
const ORIGINAL_HTML_PATH = path.join(__dirname, 'src/phase1/original-index.html');

// Create backup of original files if they don't exist
function createBackups() {
  // Create backup of original HTML if it doesn't exist
  if (!fs.existsSync(ORIGINAL_HTML_PATH)) {
    console.log('Creating backup of original HTML file...');
    const originalHtml = fs.readFileSync(HTML_FILE_PATH, 'utf8');
    fs.writeFileSync(ORIGINAL_HTML_PATH, originalHtml);
  }
  
  // CSS backup should already exist, but check just in case
  if (!fs.existsSync(ORIGINAL_CSS_PATH)) {
    console.log('Creating backup of original CSS file...');
    const originalCss = fs.readFileSync(CSS_FILE_PATH, 'utf8');
    fs.writeFileSync(ORIGINAL_CSS_PATH, originalCss);
  }
}

/**
 * Introduces comprehensive visual bugs for LLaVA-2 testing
 */
function introduceComprehensiveVisualBugs() {
  createBackups();
  
  // Read original files
  const cssContent = fs.readFileSync(CSS_FILE_PATH, 'utf8');
  const htmlContent = fs.readFileSync(HTML_FILE_PATH, 'utf8');
  
  // 1. CSS modifications for visual bugs
  let modifiedCss = cssContent;
  
  // Color contrast issue - change text color to low contrast
  modifiedCss = modifiedCss.replace(
    'color: #333;',
    'color: #b0b0b0;' // Light gray that's hard to read on white
  );
  
  // Layout shift - increase left margin on the form
  modifiedCss = modifiedCss.replace(
    '.form-group {',
    '.form-group {\n    margin-left: 50px;'
  );
  
  // Add text truncation style
  modifiedCss = modifiedCss.replace(
    '.card {',
    '.card {\n    overflow: hidden;\n    white-space: nowrap;\n    text-overflow: ellipsis;'
  );
  
  // Layout shift - make some elements overlap
  modifiedCss = modifiedCss + `
/* Added for visual bug testing */
.subtitle {
    position: relative;
    top: -15px;
    z-index: 1;
}

.btn-primary {
    position: relative;
    left: -20px;
    z-index: 2;
}

/* Truncate paragraph text */
.information-paragraph {
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
}
`;
  
  // 2. HTML modifications for visual bugs
  let modifiedHtml = htmlContent;
  
  // Add class to paragraph for text truncation
  modifiedHtml = modifiedHtml.replace(
    '<p>This is a sample application for testing visual regression with AI tools.</p>',
    '<p class="information-paragraph">This is a sample application for testing visual regression with AI tools. This text should be truncated.</p>'
  );
  
  // Hide a button (missing element)
  modifiedHtml = modifiedHtml.replace(
    '<button type="reset" class="btn btn-secondary">Reset</button>',
    '<!-- Button hidden for testing -->'
  );
  
  // Write modified files
  fs.writeFileSync(CSS_FILE_PATH, modifiedCss);
  fs.writeFileSync(HTML_FILE_PATH, modifiedHtml);
  
  console.log(`
✅ Comprehensive visual bugs introduced:
   - Text color changed to low contrast gray
   - Form groups shifted with left margin
   - Information paragraph truncated
   - Reset button removed
   - Header subtitle and submit button positioning altered to create overlap
  `);
}

/**
 * Reverts all visual bugs by restoring original files
 */
function revertComprehensiveVisualBugs() {
  try {
    // Check if original files exist
    if (!fs.existsSync(ORIGINAL_CSS_PATH) || !fs.existsSync(ORIGINAL_HTML_PATH)) {
      console.error('Original files not found. Cannot revert changes.');
      return false;
    }
    
    // Read original files
    const originalCss = fs.readFileSync(ORIGINAL_CSS_PATH, 'utf8');
    const originalHtml = fs.readFileSync(ORIGINAL_HTML_PATH, 'utf8');
    
    // Write original content back to application files
    fs.writeFileSync(CSS_FILE_PATH, originalCss);
    fs.writeFileSync(HTML_FILE_PATH, originalHtml);
    
    console.log('All visual bugs reverted. Files restored to original state.');
    
    return true;
  } catch (error) {
    console.error(`Error reverting bugs: ${error.message}`);
    return false;
  }
}

// If this script is run directly
if (require.main === module) {
  // Check for command line args
  const args = process.argv.slice(2);
  
  if (args.includes('--revert')) {
    revertComprehensiveVisualBugs();
  } else {
    introduceComprehensiveVisualBugs();
  }
}

module.exports = {
  introduceComprehensiveVisualBugs,
  revertComprehensiveVisualBugs
};
