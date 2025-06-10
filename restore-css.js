/**
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
