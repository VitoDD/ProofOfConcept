/**
 * advanced-image-finder.js
 * 
 * Helper module to find images with advanced fallback mechanisms
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Find an image file with multiple fallback strategies
 * 
 * @param {string} type - Image type (baseline, current, diff)
 * @param {string} name - Image name
 * @returns {Promise<string|null>} - Path to the image or null if not found
 */
async function findImageFile(type, name) {
  console.log(`[ImageFinder] Looking for ${type}/${name}`);
  
  // Sanitize inputs
  if (!['baseline', 'current', 'diff', 'verification'].includes(type)) {
    console.error(`[ImageFinder] Invalid image type: ${type}`);
    return null;
  }
  
  // Sanitize name to prevent path traversal
  const sanitizedName = path.basename(name);
  
  // Add .png extension if missing
  const nameWithExt = sanitizedName.endsWith('.png') ? sanitizedName : `${sanitizedName}.png`;
  
  // Generate possible locations
  const possibleLocations = [
    // Standard location
    path.join(process.cwd(), 'screenshots', type, nameWithExt),
    path.join(process.cwd(), 'screenshots', type, sanitizedName),
    
    // In reports directory
    path.join(process.cwd(), 'reports', `${type}-${nameWithExt}`),
    path.join(process.cwd(), 'reports', `${type}-${sanitizedName}`),
    path.join(process.cwd(), 'reports', nameWithExt),
    path.join(process.cwd(), 'reports', sanitizedName),
    
    // Direct files for legacy purposes
    path.join(process.cwd(), nameWithExt),
    path.join(process.cwd(), sanitizedName),
    path.join(process.cwd(), `${type}-${nameWithExt}`),
    path.join(process.cwd(), `${type}-${sanitizedName}`)
  ];
  
  // Add timestamp directories
  const timestampDirs = findTimestampDirs(path.join(process.cwd(), 'screenshots', type));
  for (const dir of timestampDirs) {
    possibleLocations.push(path.join(dir, nameWithExt));
    possibleLocations.push(path.join(dir, sanitizedName));
  }
  
  // Try each location
  let filePath = null;
  for (const location of possibleLocations) {
    try {
      await fs.access(location);
      console.log(`[ImageFinder] ✅ Found at: ${location}`);
      filePath = location;
      break;
    } catch (err) {
      // Continue to next location
    }
  }
  
  // If still not found, try directory search
  if (!filePath) {
    console.log('[ImageFinder] Searching all directories...');
    try {
      const foundPaths = await searchAllDirectories(sanitizedName, nameWithExt);
      if (foundPaths.length > 0) {
        filePath = foundPaths[0];
        console.log(`[ImageFinder] ✅ Found via search: ${filePath}`);
      }
    } catch (err) {
      console.error(`[ImageFinder] Search error: ${err.message}`);
    }
  }
  
  // Final result
  if (!filePath) {
    console.error(`[ImageFinder] ❌ Image not found: ${type}/${name}`);
  }
  
  return filePath;
}

/**
 * Find timestamp directories
 * 
 * @param {string} parentDir - Parent directory
 * @returns {Array<string>} - Array of full paths to timestamp directories
 */
function findTimestampDirs(parentDir) {
  try {
    if (!fsSync.existsSync(parentDir)) {
      return [];
    }
    
    // Get all subdirectories that look like timestamps
    const timestampDirRegex = /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;
    const dirs = fsSync.readdirSync(parentDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && timestampDirRegex.test(dirent.name))
      .map(dirent => path.join(parentDir, dirent.name));
    
    // Sort by newest first (assuming timestamp format in directory name)
    return dirs.sort((a, b) => {
      const timeA = path.basename(a).replace(/[^\d]/g, '');
      const timeB = path.basename(b).replace(/[^\d]/g, '');
      return timeB.localeCompare(timeA);
    });
  } catch (error) {
    console.error(`[ImageFinder] Error finding timestamp directories: ${error.message}`);
    return [];
  }
}

/**
 * Search all directories for files matching the name
 * 
 * @param {string} baseName - Base filename
 * @param {string} nameWithExt - Filename with extension
 * @returns {Promise<Array<string>>} - Array of paths
 */
async function searchAllDirectories(baseName, nameWithExt) {
  try {
    let searchResult = '';
    
    try {
      // Try find command (Linux/macOS)
      searchResult = execSync(
        `find ${process.cwd()} -name "*${baseName}*" -o -name "*${nameWithExt}*" | grep -v "node_modules"`,
        { encoding: 'utf8' }
      );
    } catch (findErr) {
      try {
        // Try dir command (Windows)
        searchResult = execSync(
          `dir /s /b "${baseName}*" "${nameWithExt}*"`,
          { encoding: 'utf8' }
        );
      } catch (dirErr) {
        // Both failed, return empty array
        return [];
      }
    }
    
    if (!searchResult.trim()) {
      return [];
    }
    
    // Process results
    const paths = searchResult.split('\n')
      .filter(Boolean)
      .map(p => p.trim())
      .filter(p => {
        // Verify file exists
        try {
          return fsSync.existsSync(p);
        } catch (err) {
          return false;
        }
      });
    
    return paths;
  } catch (err) {
    console.error(`[ImageFinder] Search error: ${err.message}`);
    return [];
  }
}

module.exports = {
  findImageFile
};
