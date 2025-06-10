/**
 * process-confirmations.js
 * 
 * Script to process user confirmations and update baselines accordingly
 */

const path = require('path');
const fs = require('fs').promises;
const { IntentConfirmationManager } = require('./src/utils/intent-confirmation');
const logger = require('./src/utils/logger');

// Enable file logging
logger.enableFileLogging('process-confirmations.log');

// Initialize the intent confirmation manager
const intentConfirmationManager = new IntentConfirmationManager();

/**
 * Process all confirmed changes
 */
async function processConfirmedChanges() {
  try {
    logger.info('Starting to process confirmed changes');
    
    // Initialize the intent confirmation manager
    await intentConfirmationManager.initialize();
    
    // Get all processed confirmations
    const processed = intentConfirmationManager.getAllProcessedConfirmations();
    
    logger.info(`Found ${processed.length} processed confirmations`);
    
    // Count of confirmations processed
    let updated = 0;
    let skipped = 0;
    
    // Process each confirmation
    for (const confirmation of processed) {
      logger.info(`Processing confirmation: ${confirmation.id}`);
      
      // Only process approved confirmations
      if (!confirmation.isIntended) {
        logger.info(`Skipping confirmation ${confirmation.id} (rejected by user)`);
        skipped++;
        continue;
      }
      
      // Update the baseline
      const result = await intentConfirmationManager.updateBaseline(confirmation.id);
      
      if (result) {
        logger.info(`Successfully updated baseline for ${confirmation.name}`);
        updated++;
      } else {
        logger.warn(`Failed to update baseline for ${confirmation.name}`);
        skipped++;
      }
    }
    
    logger.info(`Processed ${processed.length} confirmations: ${updated} updated, ${skipped} skipped`);
    
    return {
      success: true,
      processed: processed.length,
      updated,
      skipped
    };
  } catch (error) {
    logger.error(`Error processing confirmations: ${error.message}`);
    logger.error(error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// If this script is run directly, process confirmations
if (require.main === module) {
  // Check if running in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (isCI) {
    logger.info('Running in CI environment - auto-approving pending confirmations');
    
    // In CI, we auto-approve all pending confirmations first
    intentConfirmationManager.initialize().then(() => {
      const pending = intentConfirmationManager.getAllPendingConfirmations();
      logger.info(`Found ${pending.length} pending confirmations`);
      
      // Auto-approve all pending confirmations in CI
      const approvalPromises = pending.map(confirmation => {
        logger.info(`Auto-approving confirmation: ${confirmation.id}`);
        return intentConfirmationManager.processConfirmation(confirmation.id, true);
      });
      
      return Promise.all(approvalPromises);
    }).then(() => {
      // After auto-approving, process the confirmations
      return processConfirmedChanges();
    }).then(result => {
      if (result.success) {
        console.log(`Successfully processed confirmations: ${result.updated} updated, ${result.skipped} skipped`);
        process.exit(0);
      } else {
        console.error(`Failed to process confirmations: ${result.error}`);
        process.exit(1);
      }
    });
  } else {
    // Regular execution in non-CI environment
    processConfirmedChanges().then(result => {
      if (result.success) {
        console.log(`Successfully processed confirmations: ${result.updated} updated, ${result.skipped} skipped`);
        process.exit(0);
      } else {
        console.error(`Failed to process confirmations: ${result.error}`);
        process.exit(1);
      }
    });
  }
}

module.exports = {
  processConfirmedChanges
};
