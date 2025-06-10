/**
 * image-paths.js
 * 
 * Utility functions for managing image paths and copying
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Ensure a directory exists
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.warn(`Error creating directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a placeholder image for missing files
 * @param {string} filePath - Path to save the image
 * @param {string} message - Message to display
 * @returns {Promise<void>}
 */
async function createPlaceholderImage(filePath, message) {
  try {
    // Create a text-based placeholder
    const placeholderContent = `
Placeholder for missing image: ${message}
Generated on ${new Date().toISOString()}

This file was created automatically because the original image was not found.
    `;
    
    await fs.writeFile(filePath, placeholderContent);
    logger.debug(`Created placeholder image at ${filePath}`);
  } catch (error) {
    logger.error(`Failed to create placeholder image: ${error.message}`);
  }
}

/**
 * Copy images to reports directory with robust path handling
 * @param {string} pageName - Page name 
 * @param {string} targetDir - Target directory
 * @returns {Promise<Object>} - Result of copying operations
 */
async function copyImagesToReports(pageName, targetDir) {
  const results = {
    success: true,
    copied: [],
    errors: []
  };
  
  try {
    // Define source paths
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    
    // Ensure target directory exists
    await ensureDirectoryExists(targetDir);
    
    // Get baseline image path
    const baselinePath = path.join(screenshotsDir, 'baseline', `baseline-${pageName}.png`);
    const baselineTarget = path.join(targetDir, `baseline-${pageName}`);
    
    // Get the most recent current directory
    const currentDirs = fsSync.existsSync(path.join(screenshotsDir, 'current')) ? 
                       fsSync.readdirSync(path.join(screenshotsDir, 'current')) : [];
    
    const sortedDirs = currentDirs
      .filter(dir => !dir.startsWith('.'))
      .sort()
      .reverse();
    
    let currentPath = '';
    if (sortedDirs.length > 0) {
      currentPath = path.join(screenshotsDir, 'current', sortedDirs[0], `current-${pageName}.png`);
    }
    
    const currentTarget = path.join(targetDir, `current-${pageName}`);
    
    // Find diff image - either in the reports directory or in the diff directory
    let diffPath = path.join(targetDir, `diff-${pageName}`);
    
    if (!await fileExists(diffPath)) {
      const diffDirs = fsSync.existsSync(path.join(screenshotsDir, 'diff')) ? 
                      fsSync.readdirSync(path.join(screenshotsDir, 'diff')) : [];
                      
      const sortedDiffDirs = diffDirs
        .filter(dir => !dir.startsWith('.'))
        .sort()
        .reverse();
      
      if (sortedDiffDirs.length > 0) {
        diffPath = path.join(screenshotsDir, 'diff', sortedDiffDirs[0], `diff-${pageName}.png`);
      }
    }
    
    const diffTarget = path.join(targetDir, `diff-${pageName}`);
    
    // Copy baseline image or create placeholder
    try {
      if (await fileExists(baselinePath)) {
        await fs.copyFile(baselinePath, baselineTarget);
        results.copied.push('baseline');
      } else {
        await createPlaceholderImage(baselineTarget, `Baseline not found for ${pageName}`);
        results.errors.push(`Baseline image not found: ${baselinePath}`);
      }
    } catch (error) {
      results.errors.push(`Failed to copy baseline image: ${error.message}`);
      await createPlaceholderImage(baselineTarget, `Error copying baseline: ${error.message}`);
    }
    
    // Copy current image or create placeholder
    try {
      if (await fileExists(currentPath)) {
        await fs.copyFile(currentPath, currentTarget);
        results.copied.push('current');
      } else {
        await createPlaceholderImage(currentTarget, `Current not found for ${pageName}`);
        results.errors.push(`Current image not found: ${currentPath}`);
      }
    } catch (error) {
      results.errors.push(`Failed to copy current image: ${error.message}`);
      await createPlaceholderImage(currentTarget, `Error copying current: ${error.message}`);
    }
    
    // Copy diff image or create placeholder
    try {
      if (await fileExists(diffPath)) {
        await fs.copyFile(diffPath, diffTarget);
        results.copied.push('diff');
      } else {
        await createPlaceholderImage(diffTarget, `Diff not found for ${pageName}`);
        results.errors.push(`Diff image not found: ${diffPath}`);
      }
    } catch (error) {
      results.errors.push(`Failed to copy diff image: ${error.message}`);
      await createPlaceholderImage(diffTarget, `Error copying diff: ${error.message}`);
    }
    
    // Update success flag if any errors occurred
    if (results.errors.length > 0) {
      results.success = false;
    }
    
    return results;
  } catch (error) {
    results.success = false;
    results.errors.push(`General error: ${error.message}`);
    return results;
  }
}


/**
 * Normalize a path to ensure it references the correct location
 * @param {string} filePath - Original file path
 * @param {string} type - File type (baseline, current, diff)
 * @returns {string} - Normalized path
 */
function normalizePath(filePath, type) {
  // If already an absolute path with correct directory structure, return as is
  if (filePath && (filePath.includes('screenshots') || filePath.includes('reports'))) {
    return filePath;
  }
  
  // If it's just a filename without path
  if (filePath && !filePath.includes(path.sep)) {
    // For baseline images
    if (type === 'baseline' || filePath.startsWith('baseline-')) {
      return path.join(process.cwd(), 'screenshots', 'baseline', filePath);
    }
    
    // For current images
    if (type === 'current' || filePath.startsWith('current-')) {
      // Find most recent current directory
      const currentDirs = fsSync.existsSync(path.join(process.cwd(), 'screenshots', 'current')) ? 
                         fsSync.readdirSync(path.join(process.cwd(), 'screenshots', 'current'))
                           .filter(dir => !dir.startsWith('.'))
                           .sort()
                           .reverse() : [];
                           
      if (currentDirs.length > 0) {
        return path.join(process.cwd(), 'screenshots', 'current', currentDirs[0], filePath);
      } else {
        return path.join(process.cwd(), 'screenshots', 'current', filePath);
      }
    }
    
    // For diff images
    if (type === 'diff' || filePath.startsWith('diff-')) {
      // Find most recent diff directory
      const diffDirs = fsSync.existsSync(path.join(process.cwd(), 'screenshots', 'diff')) ? 
                       fsSync.readdirSync(path.join(process.cwd(), 'screenshots', 'diff'))
                         .filter(dir => !dir.startsWith('.'))
                         .sort()
                         .reverse() : [];
                         
      if (diffDirs.length > 0) {
        return path.join(process.cwd(), 'screenshots', 'diff', diffDirs[0], filePath);
      } else {
        return path.join(process.cwd(), 'screenshots', 'diff', filePath);
      }
    }
    
    // For report images
    if (type === 'report') {
      return path.join(process.cwd(), 'reports', filePath);
    }
  }
  
  // Default fallback
  return filePath;
}

module.exports = {
  normalizePath,
  ensureDirectoryExists,
  fileExists,
  createPlaceholderImage,
  copyImagesToReports
};
