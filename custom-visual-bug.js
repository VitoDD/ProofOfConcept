/**
 * custom-visual-bug.js
 * 
 * A script that introduces a very obvious and easily fixable visual bug
 * for testing the self-healing capabilities of Phase 4.
 */

const fs = require('fs');
const path = require('path');

// Path constants
const CSS_FILE_PATH = path.join(__dirname, 'public', 'styles.css');
const BACKUP_CSS_PATH = path.join(__dirname, 'backups', 'styles-backup.css');

console.log('🔍 Creating a custom visual bug for testing Phase 4...');

// First, backup the current CSS
console.log('📦 Backing up current CSS...');
if (!fs.existsSync(path.join(__dirname, 'backups'))) {
  fs.mkdirSync(path.join(__dirname, 'backups'), { recursive: true });
}
fs.copyFileSync(CSS_FILE_PATH, BACKUP_CSS_PATH);
console.log(`✅ CSS backed up to ${BACKUP_CSS_PATH}`);

// Read the current CSS content
let cssContent = fs.readFileSync(CSS_FILE_PATH, 'utf8');

// Define the changes to make - this will create a very obvious change
const changes = [
  // Change the primary button to bright green
  {
    from: '.btn-primary {\n    background-color: #3498db;',
    to: '.btn-primary {\n    background-color: #2ecc71;'
  },
  // Make the font size larger
  {
    from: 'font-size: 16px;',
    to: 'font-size: 20px;'
  },
  // Make form controls have a distinctive border
  {
    from: 'border: 1px solid #ddd;',
    to: 'border: 2px solid #3498db;'
  },
  // Change the card background color
  {
    from: 'background-color: #fff;',
    to: 'background-color: #f0f8ff;'
  }
];

// Apply the changes
console.log('🔧 Introducing visual changes:');
for (const change of changes) {
  const newContent = cssContent.replace(change.from, change.to);
  if (newContent === cssContent) {
    console.log(`⚠️ Could not find pattern: "${change.from.split('\n')[0]}..."`);
  } else {
    cssContent = newContent;
    console.log(`✅ Changed "${change.from.split('\n')[0]}..." to "${change.to.split('\n')[0]}..."`);
  }
}

// Write the modified CSS back
fs.writeFileSync(CSS_FILE_PATH, cssContent);
console.log('✅ Visual bug introduced!');

// Suggest next steps
console.log('\n🚀 Next steps:');
console.log('1. Run phase4 testing:');
console.log('   node run-phase4.js');
console.log('2. Check the reports directory for results');
console.log('3. To restore the original CSS:');
console.log('   node restore-css.js');

// Create a restore script
const restoreScript = `/**
 * restore-css.js
 * 
 * Restores the original CSS from backup
 */

const fs = require('fs');
const path = require('path');

const CSS_FILE_PATH = path.join(__dirname, 'public', 'styles.css');
const BACKUP_CSS_PATH = path.join(__dirname, 'backups', 'styles-backup.css');

console.log('Restoring original CSS from backup...');
try {
  if (fs.existsSync(BACKUP_CSS_PATH)) {
    fs.copyFileSync(BACKUP_CSS_PATH, CSS_FILE_PATH);
    console.log('✅ CSS restored successfully!');
  } else {
    console.error('❌ Backup file not found at ' + BACKUP_CSS_PATH);
  }
} catch (error) {
  console.error('❌ Error restoring CSS: ' + error.message);
}
`;

// Write the restore script
fs.writeFileSync(path.join(__dirname, 'restore-css.js'), restoreScript);
console.log('✅ Restore script created: restore-css.js');
