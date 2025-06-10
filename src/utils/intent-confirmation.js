/**
 * intent-confirmation.js
 * 
 * Module for handling user intent confirmation for visual differences
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Class for managing user intent confirmations
 */
class IntentConfirmationManager {
  constructor(options = {}) {
    this.basePath = options.basePath || path.join(process.cwd(), 'reports', 'intent-confirmations');
    this.intentStore = new Map();
    this.pendingStore = new Map();
  }

  /**
   * Initialize the intent confirmation system
   */
  async initialize() {
    try {
      // Create the confirmation directory if it doesn't exist
      await fs.mkdir(this.basePath, { recursive: true });
      
      // Load any saved confirmations
      await this.loadSavedConfirmations();
      
      logger.info('Intent confirmation system initialized');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize intent confirmation system: ${error.message}`);
      return false;
    }
  }

  /**
   * Load saved confirmations from the filesystem
   */
  async loadSavedConfirmations() {
    try {
      const confirmationsPath = path.join(this.basePath, 'confirmations.json');
      const pendingPath = path.join(this.basePath, 'pending.json');
      
      try {
        const confirmationsData = await fs.readFile(confirmationsPath, 'utf8');
        const confirmations = JSON.parse(confirmationsData);
        
        for (const [key, value] of Object.entries(confirmations)) {
          this.intentStore.set(key, value);
        }
        
        logger.info(`Loaded ${this.intentStore.size} saved confirmations`);
      } catch (err) {
        // File doesn't exist or is invalid, start with empty store
        logger.info('No existing confirmations found, starting with empty store');
      }
      
      try {
        const pendingData = await fs.readFile(pendingPath, 'utf8');
        const pending = JSON.parse(pendingData);
        
        for (const [key, value] of Object.entries(pending)) {
          this.pendingStore.set(key, value);
        }
        
        logger.info(`Loaded ${this.pendingStore.size} pending confirmations`);
      } catch (err) {
        // File doesn't exist or is invalid, start with empty store
        logger.info('No existing pending confirmations found, starting with empty store');
      }
    } catch (error) {
      logger.error(`Error loading saved confirmations: ${error.message}`);
    }
  }

  /**
   * Save confirmations to the filesystem
   */
  async saveConfirmations() {
    try {
      const confirmationsPath = path.join(this.basePath, 'confirmations.json');
      const pendingPath = path.join(this.basePath, 'pending.json');
      
      // Convert Map to Object for JSON serialization
      const confirmations = Object.fromEntries(this.intentStore);
      const pending = Object.fromEntries(this.pendingStore);
      
      await fs.writeFile(confirmationsPath, JSON.stringify(confirmations, null, 2), 'utf8');
      await fs.writeFile(pendingPath, JSON.stringify(pending, null, 2), 'utf8');
      
      logger.info('Saved confirmations to disk');
    } catch (error) {
      logger.error(`Error saving confirmations: ${error.message}`);
    }
  }

  /**
   * Register a new pending confirmation
   * 
   * @param {Object} issue - The issue that needs confirmation
   * @returns {String} - The unique ID for this confirmation
   */
  async registerPendingConfirmation(issue) {
    try {
      // Generate a unique ID
      const confirmationId = `${issue.name}-${Date.now()}`;
      
      // Create a record for this pending confirmation
      const pendingConfirmation = {
        id: confirmationId,
        name: issue.name,
        timestamp: Date.now(),
        status: 'pending',
        issue: {
          name: issue.name,
          baselineImagePath: issue.baselineImagePath,
          currentImagePath: issue.currentImagePath,
          diffImagePath: issue.diffImagePath,
          diffPercentage: issue.diffPercentage,
          diffPixelCount: issue.diffPixelCount
        }
      };
      
      // Add to pending store
      this.pendingStore.set(confirmationId, pendingConfirmation);
      
      // Save to disk
      await this.saveConfirmations();
      
      return confirmationId;
    } catch (error) {
      logger.error(`Error registering pending confirmation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process user confirmation
   * 
   * @param {String} confirmationId - The ID of the confirmation
   * @param {Boolean} isIntended - Whether the change is intended
   * @returns {Object} - The updated confirmation record
   */
  async processConfirmation(confirmationId, isIntended) {
    try {
      // Get the pending confirmation
      const pendingConfirmation = this.pendingStore.get(confirmationId);
      
      if (!pendingConfirmation) {
        logger.warn(`No pending confirmation found with ID: ${confirmationId}`);
        throw new Error(`No pending confirmation found with ID: ${confirmationId}`);
      }
      
      // Update the confirmation
      pendingConfirmation.status = isIntended ? 'approved' : 'rejected';
      pendingConfirmation.confirmedAt = Date.now();
      pendingConfirmation.isIntended = isIntended;
      
      // Move from pending to confirmed
      this.intentStore.set(confirmationId, pendingConfirmation);
      this.pendingStore.delete(confirmationId);
      
      // Save to disk
      await this.saveConfirmations();
      
      // If the change was approved, update the baseline immediately if needed
      if (isIntended && pendingConfirmation.issue) {
        try {
          // Only update baseline immediately if specified in options
          const updateResult = await this.updateBaseline(confirmationId);
          logger.info(`Baseline update result: ${updateResult ? 'success' : 'failed'}`);
          pendingConfirmation.baselineUpdated = updateResult;
        } catch (updateError) {
          logger.error(`Error updating baseline: ${updateError.message}`);
          pendingConfirmation.baselineUpdateError = updateError.message;
        }
      }
      
      return pendingConfirmation;
    } catch (error) {
      logger.error(`Error processing confirmation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a confirmation is pending for an issue
   * 
   * @param {String} issueName - The name of the issue
   * @returns {Object|null} - The pending confirmation or null
   */
  getPendingConfirmationByName(issueName) {
    for (const [_, confirmation] of this.pendingStore.entries()) {
      if (confirmation.name === issueName) {
        return confirmation;
      }
    }
    
    return null;
  }

  /**
   * Get all pending confirmations
   * 
   * @returns {Array} - Array of pending confirmations
   */
  getAllPendingConfirmations() {
    return Array.from(this.pendingStore.values());
  }

  /**
   * Get all processed confirmations
   * 
   * @returns {Array} - Array of processed confirmations
   */
  getAllProcessedConfirmations() {
    return Array.from(this.intentStore.values());
  }
  
  /**
   * Get a processed confirmation by ID
   * 
   * @param {String} confirmationId - The ID of the confirmation
   * @returns {Object|null} - The confirmation or null if not found
   */
  getProcessedConfirmation(confirmationId) {
    return this.intentStore.get(confirmationId) || null;
  }

  /**
   * Update the baseline image for an issue if it is confirmed as intended
   * 
   * @param {String} confirmationId - The ID of the confirmation
   * @returns {Promise<Boolean>} - Whether the baseline was updated
   */
  async updateBaseline(confirmationId) {
    try {
      // Get the confirmation
      const confirmation = this.getProcessedConfirmation(confirmationId);
      
      if (!confirmation || !confirmation.isIntended) {
        logger.warn(`Cannot update baseline for ${confirmationId}: not found or not approved`);
        return false;
      }
      
      // Get paths
      let currentImagePath = confirmation.issue.currentImagePath;
      let baselineImagePath = confirmation.issue.baselineImagePath;
      
      logger.info(`Attempting to update baseline from ${currentImagePath} to ${baselineImagePath}`);
      
      // Try to find the actual image files
      const { findImageFile } = require('./advanced-image-finder');
      
      // Find the actual current image file
      let sourceFilePath = null;
      try {
        // Try to find current image using the helper
        sourceFilePath = await findImageFile('current', path.basename(currentImagePath));
        
        if (!sourceFilePath) {
          // Try direct access
          const directPath = path.join(process.cwd(), 'screenshots', 'current', path.basename(currentImagePath));
          if (fsSync.existsSync(directPath)) {
            sourceFilePath = directPath;
          }
          
          // Try with extension
          const withExtPath = directPath.endsWith('.png') ? directPath : directPath + '.png';
          if (fsSync.existsSync(withExtPath)) {
            sourceFilePath = withExtPath;
          }
          
          // Try searching in timestamp directories
          if (!sourceFilePath) {
            const currentDir = path.join(process.cwd(), 'screenshots', 'current');
            if (fsSync.existsSync(currentDir)) {
              const timestampDirs = fsSync.readdirSync(currentDir)
                .filter(d => fsSync.statSync(path.join(currentDir, d)).isDirectory())
                .filter(d => d.match(/\d{4}-\d{2}-\d{2}T/))
                .sort()  // Sort by timestamp
                .reverse();  // Most recent first
              
              for (const dir of timestampDirs) {
                const inTimestampPath = path.join(currentDir, dir, path.basename(currentImagePath));
                const withExt = inTimestampPath.endsWith('.png') ? inTimestampPath : inTimestampPath + '.png';
                
                if (fsSync.existsSync(inTimestampPath)) {
                  sourceFilePath = inTimestampPath;
                  break;
                } else if (fsSync.existsSync(withExt)) {
                  sourceFilePath = withExt;
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        logger.error(`Error finding current image: ${err.message}`);
      }
      
      if (!sourceFilePath) {
        logger.error(`Could not find current image: ${currentImagePath}`);
        return false;
      }
      
      // Determine the target baseline path
      let targetFilePath = null;
      try {
        const baselineDir = path.join(process.cwd(), 'screenshots', 'baseline');
        if (!fsSync.existsSync(baselineDir)) {
          fsSync.mkdirSync(baselineDir, { recursive: true });
        }
        
        // Use same extension as source file
        const ext = path.extname(sourceFilePath) || '.png';
        const baseFilename = path.basename(baselineImagePath, path.extname(baselineImagePath));
        targetFilePath = path.join(baselineDir, baseFilename + ext);
      } catch (err) {
        logger.error(`Error determining baseline path: ${err.message}`);
        return false;
      }
      
      // Copy the file
      try {
        logger.info(`Copying ${sourceFilePath} to ${targetFilePath}`);
        fsSync.copyFileSync(sourceFilePath, targetFilePath);
        logger.info(`Successfully updated baseline for ${confirmation.name}`);
        return true;
      } catch (err) {
        logger.error(`Error copying file: ${err.message}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error updating baseline: ${error.message}`);
      return false;
    }
  }
}

module.exports = {
  IntentConfirmationManager
};
