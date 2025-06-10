/**
 * clear-confirmation-history.js
 * 
 * This script clears all confirmation history (both pending and processed)
 */

const fs = require('fs');
const path = require('path');

function clearConfirmationHistory() {
  try {
    console.log('Clearing confirmation history...');
    
    const confirmationsDir = path.join(__dirname, 'reports', 'intent-confirmations');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(confirmationsDir)) {
      fs.mkdirSync(confirmationsDir, { recursive: true });
    }
    
    // Create/overwrite with empty confirmation files
    fs.writeFileSync(
      path.join(confirmationsDir, 'confirmations.json'),
      JSON.stringify({})
    );
    
    fs.writeFileSync(
      path.join(confirmationsDir, 'pending.json'),
      JSON.stringify({})
    );
    
    console.log('✅ Confirmation history cleared successfully!');
    return true;
  } catch (error) {
    console.error(`Error clearing confirmation history: ${error.message}`);
    return false;
  }
}

// If this script is run directly, clear the history
if (require.main === module) {
  clearConfirmationHistory();
}

// Export for use in other scripts
module.exports = clearConfirmationHistory;
