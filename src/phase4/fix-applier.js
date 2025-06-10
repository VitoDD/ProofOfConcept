/**
 * fix-applier.js
 * 
 * Applies generated fixes to the source code
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const logger = require('../utils/logger');

// Add line matcher utilities
try {
  var lineMatcher = require('./utils/line-matcher');
} catch (error) {
  logger.warn(`Could not load line-matcher utilities: ${error.message}. Using built-in fallbacks.`);
  lineMatcher = null;
}

/**
 * FixApplier class responsible for applying fixes to source code
 */
class FixApplier {
  /**
   * Creates a new FixApplier instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.backupDir = options.backupDir || path.join(process.cwd(), 'backups');
    
    // Create a unique backup directory name with timestamp
    this.currentBackupDir = path.join(
      this.backupDir, 
      `backup-${new Date().toISOString().replace(/:/g, '-')}`
    );
    
    logger.info(`Initialized FixApplier with${this.dryRun ? ' DRY RUN' : ''} mode`);
  }
  
  /**
   * Applies a fix to the specified file
   * 
   * @param {Object} fix - Fix object with file path, line number, and code changes
   * @returns {Promise<Object>} - Result of applying the fix
   */
  /**
   * Normalize a file path to resolve to the correct location
   * 
   * @param {string} filePath - The file path to normalize
   * @returns {string} - The normalized path
   * @private
   */
  _normalizeFilePath(filePath) {
    if (!filePath) return filePath;
    
    // If it's already an absolute path, return as is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // Check if this is a reference to a file in the public directory
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      // Common files that should be in public
      const publicFiles = ['styles.css', 'script.js', 'index.html'];
      
      if (publicFiles.includes(filePath)) {
        return path.join(process.cwd(), 'public', filePath);
      }
    }
    
    // Default to the original path
    return filePath;
  }

  async applyFix(fix) {
    // Normalize the file path
    const normalizedPath = this._normalizeFilePath(fix.filePath);
    logger.info(`Applying fix to ${normalizedPath} (line ${fix.lineNumber})`);
    
    try {
      // Read the file content
      const content = await fs.readFile(normalizedPath, 'utf-8');
      
      // Split into lines for easier manipulation
      const lines = content.split('\n');
      
      // Check if line number is valid
      if (fix.lineNumber <= 0 || fix.lineNumber > lines.length) {
        throw new Error(`Line number ${fix.lineNumber} is out of range (file has ${lines.length} lines)`);
      }
      
      // Extract the target line (0-based indexing)
      const targetLine = lines[fix.lineNumber - 1];
      
      // Verify that the current content matches what we expect
      if (!this._lineMatches(targetLine, fix.currentContent)) {
        logger.warn(`Line content doesn't match exactly. Expected: "${fix.currentContent}", Found: "${targetLine}"`);
        
        // Try fuzzy matching
        if (this._fuzzyLineMatches(targetLine, fix.currentContent)) {
          logger.info(`Fuzzy match found, proceeding with fix`);
        } else {
          throw new Error(`Line content doesn't match expected content`);
        }
      }
      
      // Create backup before modifying
      await this._createBackup(fix.filePath);
      
      // Apply the fix
      lines[fix.lineNumber - 1] = fix.suggestedFix;
      
      // Join the lines back together
      const newContent = lines.join('\n');
      
      // In dry run mode, just return the expected changes
      if (this.dryRun) {
        logger.info(`DRY RUN: Would modify ${normalizedPath}`);
        return {
          status: 'simulated',
          filePath: normalizedPath,
          lineNumber: fix.lineNumber,
          oldContent: targetLine,
          newContent: fix.suggestedFix
        };
      }
      
      // Write the modified content back to the file
      await fs.writeFile(normalizedPath, newContent, 'utf-8');
      
      logger.info(`Successfully applied fix to ${normalizedPath}`);
      
      return {
        status: 'success',
        filePath: normalizedPath,
        lineNumber: fix.lineNumber,
        oldContent: targetLine,
        newContent: fix.suggestedFix
      };
    } catch (error) {
      logger.error(`Error applying fix to ${normalizedPath}: ${error.message}`);
      
      return {
        status: 'error',
        filePath: normalizedPath,
        lineNumber: fix.lineNumber,
        error: error.message
      };
    }
  }
  
  /**
   * Applies multiple fixes to the codebase
   * 
   * @param {Array} fixes - Array of fix objects to apply
   * @returns {Promise<Array>} - Results of applying the fixes
   */
  async applyMultipleFixes(fixes) {
    logger.info(`Applying ${fixes.length} fixes`);
    
    const results = [];
    const fileCache = new Map(); // Cache file contents to avoid redundant reads
    
    try {
      // Group fixes by file path to minimize file operations
      const fixesByFile = this._groupFixesByFile(fixes);
      
      // Apply fixes for each file
      for (const [filePath, groupedFixes] of Object.entries(fixesByFile)) {
        // Sort fixes by line number in descending order
        // This way, applying fixes won't change line numbers of subsequent fixes
        const sortedFixes = groupedFixes.sort((a, b) => b.lineNumber - a.lineNumber);
        
        // Read the file content once
        const content = await fs.readFile(filePath, 'utf-8');
        fileCache.set(filePath, content);
        
        // Create backup before any modifications
        await this._createBackup(filePath);
        
        // Apply all fixes for this file
        const fileResults = await this._applyFixesToFile(filePath, sortedFixes, fileCache);
        results.push(...fileResults);
      }
      
      logger.info(`Applied ${results.filter(r => r.status === 'success').length}/${fixes.length} fixes successfully`);
      
      return results;
    } catch (error) {
      logger.error(`Error applying multiple fixes: ${error.message}`);
      
      return [
        ...results,
        {
          status: 'error',
          error: error.message,
          global: true
        }
      ];
    }
  }
  
  /**
   * Apply multiple fixes to a single file
   * 
   * @param {string} filePath - Path to the file
   * @param {Array} fixes - Fixes to apply (sorted by line number in descending order)
   * @param {Map} fileCache - Cache of file contents
   * @returns {Promise<Array>} - Results of applying the fixes
   * @private
   */
  async _applyFixesToFile(filePath, fixes, fileCache) {
    try {
      // Get file content from cache
      let content = fileCache.get(filePath);
      const originalContent = content; // Keep original for comparison
      
      // Split into lines
      const lines = content.split('\n');
      
      const results = [];
      
      // Apply each fix
      for (const fix of fixes) {
        try {
          // Check if line number is valid
          if (fix.lineNumber <= 0 || fix.lineNumber > lines.length) {
            results.push({
              status: 'error',
              filePath: fix.filePath,
              lineNumber: fix.lineNumber,
              error: `Line number ${fix.lineNumber} is out of range (file has ${lines.length} lines)`
            });
            continue;
          }
          
          // Extract the target line (0-based indexing)
          const targetLine = lines[fix.lineNumber - 1];
          
          // Check if this is a CSS file
          const isCssFile = filePath.toLowerCase().endsWith('.css');
          
          // Verify that the current content matches what we expect
          if (!this._lineMatches(targetLine, fix.currentContent)) {
            // Special handling for CSS files
            let lineToModify = fix.lineNumber - 1;
            let cssMatchFound = false;
            
            if (isCssFile && lineMatcher) {
              // Try to find the correct CSS property or selector
              cssMatchFound = lineMatcher.findCssMatch(
                lines, 
                fix.currentContent,
                (matchedIndex) => {
                  lineToModify = matchedIndex;
                  logger.info(`CSS match found at line ${matchedIndex + 1} instead of ${fix.lineNumber}`);
                }
              );
            }
            
            // If CSS match found, use that line
            if (cssMatchFound) {
              // Update the line number for the fix
              fix.lineNumber = lineToModify + 1;
            } else if (this._fuzzyLineMatches(targetLine, fix.currentContent)) {
              logger.info(`Fuzzy match found for line ${fix.lineNumber}, proceeding with fix`);
            } else {
              // If no special match found, look through all lines
              if (lineMatcher) {
                const bestMatch = lineMatcher.findBestMatchingLine(lines, fix.currentContent);
                if (bestMatch.score > 0.6) {
                  lineToModify = bestMatch.index;
                  fix.lineNumber = lineToModify + 1;
                  logger.info(`Best match found at line ${fix.lineNumber}`);
                } else {
                  results.push({
                    status: 'error',
                    filePath: fix.filePath,
                    lineNumber: fix.lineNumber,
                    error: `Line content doesn't match expected content`,
                    expected: fix.currentContent,
                    actual: targetLine
                  });
                  continue;
                }
              } else {
                results.push({
                  status: 'error',
                  filePath: fix.filePath,
                  lineNumber: fix.lineNumber,
                  error: `Line content doesn't match expected content`,
                  expected: fix.currentContent,
                  actual: targetLine
                });
                continue;
              }
            }
          }
          
          // Apply the fix
          if (this.dryRun) {
            logger.info(`DRY RUN: Would modify ${fix.filePath} line ${fix.lineNumber}`);
            results.push({
              status: 'simulated',
              filePath: fix.filePath,
              lineNumber: fix.lineNumber,
              oldContent: lines[fix.lineNumber - 1],
              newContent: fix.suggestedFix
            });
          } else {
            // Apply the fix to the lines array
            lines[fix.lineNumber - 1] = fix.suggestedFix;
            
            results.push({
              status: 'success',
              filePath: fix.filePath,
              lineNumber: fix.lineNumber,
              oldContent: targetLine,
              newContent: fix.suggestedFix
            });
          }
        } catch (fixError) {
          results.push({
            status: 'error',
            filePath: fix.filePath,
            lineNumber: fix.lineNumber,
            error: fixError.message
          });
        }
      }
      
      // Join the lines back together
      const newContent = lines.join('\n');
      
      // If content changed and not in dry run mode, write it back
      if (newContent !== originalContent && !this.dryRun) {
        await fs.writeFile(filePath, newContent, 'utf-8');
        logger.info(`Successfully applied fixes to ${filePath}`);
        
        // Update the cache
        fileCache.set(filePath, newContent);
      }
      
      return results;
    } catch (error) {
      logger.error(`Error applying fixes to ${filePath}: ${error.message}`);
      
      return [{
        status: 'error',
        filePath,
        error: error.message,
        fileLevel: true
      }];
    }
  }
  
  /**
   * Group fixes by file path
   * 
   * @param {Array} fixes - Array of fix objects
   * @returns {Object} - Fixes grouped by file path
   * @private
   */
  _groupFixesByFile(fixes) {
    const groups = {};
    
    for (const fix of fixes) {
      const filePath = fix.filePath;
      
      if (!groups[filePath]) {
        groups[filePath] = [];
      }
      
      groups[filePath].push(fix);
    }
    
    return groups;
  }
  
  /**
   * Create a backup of a file before modification
   * 
   * @param {string} filePath - Path to the file
   * @private
   */
  async _createBackup(filePath) {
    try {
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.currentBackupDir, { recursive: true });
      
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Create backup filename
      const fileName = path.basename(filePath);
      const backupPath = path.join(this.currentBackupDir, fileName);
      
      // Write backup
      await fs.writeFile(backupPath, content, 'utf-8');
      
      logger.debug(`Created backup of ${filePath} at ${backupPath}`);
    } catch (error) {
      logger.warn(`Failed to create backup of ${filePath}: ${error.message}`);
      // Continue without backup - not critical enough to fail the operation
    }
  }
  
  /**
   * Restore a file from backup
   * 
   * @param {string} filePath - Path to the file to restore
   * @returns {Promise<boolean>} - Whether the restore was successful
   */
  async restoreFromBackup(filePath) {
    try {
      const fileName = path.basename(filePath);
      const backupPath = path.join(this.currentBackupDir, fileName);
      
      // Check if backup exists
      try {
        await fs.access(backupPath);
      } catch (err) {
        logger.warn(`No backup found for ${filePath}`);
        return false;
      }
      
      // Read backup content
      const content = await fs.readFile(backupPath, 'utf-8');
      
      // Write content back to original file
      await fs.writeFile(filePath, content, 'utf-8');
      
      logger.info(`Successfully restored ${filePath} from backup`);
      return true;
    } catch (error) {
      logger.error(`Error restoring ${filePath} from backup: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check if a line matches the expected content
   * 
   * @param {string} line - Actual line content
   * @param {string} expected - Expected line content
   * @returns {boolean} - Whether the line matches
   * @private
   */
  _lineMatches(line, expected) {
    // Use line matcher utilities if available
    if (lineMatcher) {
      const result = lineMatcher.verifyLineContent([line], 1, expected);
      return result.match;
    }
    
    // Fallback to built-in matching
    
    // Exact match
    if (line === expected) {
      return true;
    }
    
    // Trim whitespace and check again
    if (line.trim() === expected.trim()) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a line approximately matches the expected content
   * 
   * @param {string} line - Actual line content
   * @param {string} expected - Expected line content
   * @returns {boolean} - Whether the line approximately matches
   * @private
   */
  _fuzzyLineMatches(line, expected) {
    // Use line matcher utilities if available
    if (lineMatcher) {
      // Special handling for CSS files
      const isCssFile = expected.includes('.css') || 
                      expected.includes('background-color') || 
                      expected.includes('font-size') ||
                      expected.includes('border:');
                      
      if (isCssFile) {
        let matched = false;
        lineMatcher.findCssMatch([line], expected, () => {
          matched = true;
        });
        
        if (matched) {
          return true;
        }
      }
      
      // Try similarity check
      const similarity = lineMatcher.calculateSimilarity(line, expected);
      return similarity > 0.6; // Lower threshold for better matching
    }
    
    // Fallback to built-in matching
    
    // Remove all whitespace and compare
    const normalizedLine = line.replace(/\s+/g, '');
    const normalizedExpected = expected.replace(/\s+/g, '');
    
    if (normalizedLine === normalizedExpected) {
      return true;
    }
    
    // Calculate similarity (simple approach)
    const similarity = this._calculateSimilarity(line, expected);
    
    // If similarity is high enough, consider it a match
    return similarity > 0.6; // Reduced threshold
  }
  
  /**
   * Calculate similarity between two strings (0 to 1)
   * 
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score from 0 to 1
   * @private
   */
  _calculateSimilarity(str1, str2) {
    if (!str1 && !str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    
    // Normalize strings
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Levenshtein distance implementation (simplified)
    const len1 = s1.length;
    const len2 = s2.length;
    
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,        // deletion
          matrix[i][j - 1] + 1,        // insertion
          matrix[i - 1][j - 1] + cost  // substitution
        );
      }
    }
    
    // The last value in the matrix is the Levenshtein distance
    const distance = matrix[len1][len2];
    
    // Convert to similarity score (0 to 1)
    const maxLength = Math.max(len1, len2);
    if (maxLength === 0) return 1.0;
    
    return 1.0 - (distance / maxLength);
  }
}

module.exports = { FixApplier };
