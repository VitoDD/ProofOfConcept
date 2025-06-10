/**
 * compare.js
 * 
 * Utility for comparing screenshots and detecting visual differences.
 * Uses pixelmatch to compare images pixel-by-pixel and generate difference maps.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

// Directory for storing screenshots
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');

// Directory for storing comparison results
const RESULTS_DIR = path.join(__dirname, '../../reports');

/**
 * Ensures the results directory exists
 */
async function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Compares two images and generates a diff image
 * 
 * @param {string} baselineImagePath - Path to the baseline image
 * @param {string} currentImagePath - Path to the current image
 * @param {string} diffOutputPath - Path to save the diff image
 * @param {Object} options - Comparison options
 * @returns {Object} - Comparison results
 */
async function compareImages(baselineImagePath, currentImagePath, diffOutputPath, options = {}) {
  // Ensure output directory exists
  const diffDir = path.dirname(diffOutputPath);
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  
  // Set default options
  const defaultOptions = {
    threshold: 0.1,      // Threshold for pixel difference (0-1)
    includeAA: false,    // Whether to include anti-aliased pixels in the diff
    alpha: 0.3,          // Opacity of original image in diff output (increased for better visibility)
    aaColor: [255, 255, 0],  // Color of anti-aliased pixels
    diffColor: [255, 0, 0],  // Color of different pixels
    diffMask: false,     // Whether to generate a diff mask
    outputDiffMask: true // Enhanced: Create a more visible diff
  };
  
  const comparisonOptions = { ...defaultOptions, ...options };
  
  try {
    // Read baseline image
    const baseline = PNG.sync.read(fs.readFileSync(baselineImagePath));
    
    // Read current image
    const current = PNG.sync.read(fs.readFileSync(currentImagePath));
    
    // Check if images have the same dimensions
    if (baseline.width !== current.width || baseline.height !== current.height) {
      console.warn(`Image dimensions do not match for ${path.basename(baselineImagePath)} and ${path.basename(currentImagePath)}`);
      console.warn(`Baseline: ${baseline.width}x${baseline.height}, Current: ${current.width}x${current.height}`);
      
      // Create a more informative diff image for dimension mismatch
      const diffWidth = Math.max(baseline.width, current.width);
      const diffHeight = Math.max(baseline.height, current.height);
      
      const diff = new PNG({ width: diffWidth, height: diffHeight });
      
      // Draw the baseline image with a blue tint
      for (let y = 0; y < baseline.height; y++) {
        for (let x = 0; x < baseline.width; x++) {
          if (y < diffHeight && x < diffWidth) {
            const idx = (y * diffWidth + x) << 2;
            const baseIdx = (y * baseline.width + x) << 2;
            
            // Get baseline pixel with blue tint
            diff.data[idx] = Math.min(baseline.data[baseIdx] * 0.7, 255);     // R
            diff.data[idx + 1] = Math.min(baseline.data[baseIdx + 1] * 0.7, 255); // G
            diff.data[idx + 2] = Math.min(baseline.data[baseIdx + 2] + 50, 255);  // B with blue boost
            diff.data[idx + 3] = baseline.data[baseIdx + 3];  // A
          }
        }
      }
      
      // Draw the current image with a red tint, offset to show dimension difference
      for (let y = 0; y < current.height; y++) {
        for (let x = 0; x < current.width; x++) {
          // Offset for visual difference
          const offsetX = Math.min(10, Math.floor(diffWidth * 0.02));
          const offsetY = Math.min(10, Math.floor(diffHeight * 0.02));
          
          if ((y + offsetY) < diffHeight && (x + offsetX) < diffWidth) {
            const idx = ((y + offsetY) * diffWidth + (x + offsetX)) << 2;
            const currentIdx = (y * current.width + x) << 2;
            
            // Only draw if not overwriting baseline (semi-transparent blend)
            diff.data[idx] = Math.min(current.data[currentIdx] + 50, 255);     // R with red boost
            diff.data[idx + 1] = Math.min(current.data[currentIdx + 1] * 0.7, 255); // G
            diff.data[idx + 2] = Math.min(current.data[currentIdx + 2] * 0.7, 255); // B
            diff.data[idx + 3] = 200;  // A - semi-transparent
          }
        }
      }
      
      // Add a border around the images to highlight size difference
      const borderWidth = 4;
      
      // Baseline border (blue)
      for (let y = 0; y < baseline.height; y++) {
        for (let x = 0; x < baseline.width; x++) {
          if (y < borderWidth || y >= baseline.height - borderWidth || 
              x < borderWidth || x >= baseline.width - borderWidth) {
            if (y < diffHeight && x < diffWidth) {
              const idx = (y * diffWidth + x) << 2;
              diff.data[idx] = 0;     // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 255; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      // Current border (red) - with offset
      for (let y = 0; y < current.height; y++) {
        for (let x = 0; x < current.width; x++) {
          if (y < borderWidth || y >= current.height - borderWidth || 
              x < borderWidth || x >= current.width - borderWidth) {
            const offsetX = Math.min(10, Math.floor(diffWidth * 0.02));
            const offsetY = Math.min(10, Math.floor(diffHeight * 0.02));
            
            if ((y + offsetY) < diffHeight && (x + offsetX) < diffWidth) {
              const idx = ((y + offsetY) * diffWidth + (x + offsetX)) << 2;
              diff.data[idx] = 255;   // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 0; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      // Add text for dimensions at the bottom
      const baselineDimText = `Baseline: ${baseline.width}x${baseline.height}`;
      const currentDimText = `Current: ${current.width}x${current.height}`;
      
      // This is a simple way to "write" text by changing pixel colors
      // Real text would require more sophisticated rendering
      for (let i = 0; i < baselineDimText.length; i++) {
        const x = 10 + (i * 8);
        const y = diffHeight - 30;
        
        if (x < diffWidth && y < diffHeight) {
          for (let dy = 0; dy < 10; dy++) {
            for (let dx = 0; dx < 6; dx++) {
              const idx = ((y + dy) * diffWidth + (x + dx)) << 2;
              diff.data[idx] = 0;     // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 255; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      for (let i = 0; i < currentDimText.length; i++) {
        const x = 10 + (i * 8);
        const y = diffHeight - 15;
        
        if (x < diffWidth && y < diffHeight) {
          for (let dy = 0; dy < 10; dy++) {
            for (let dx = 0; dx < 6; dx++) {
              const idx = ((y + dy) * diffWidth + (x + dx)) << 2;
              diff.data[idx] = 255;   // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 0; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      // Save diff image
      fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));
      
      // Return results indicating dimension mismatch
      return {
        baselineImagePath,
        currentImagePath,
        diffImagePath: diffOutputPath,
        width: diffWidth,
        height: diffHeight,
        diffPixelCount: diffWidth * diffHeight, // Consider all pixels different
        totalPixels: diffWidth * diffHeight,
        diffPercentage: 100, // 100% different
        hasDifferences: true,
        dimensionMismatch: true,
        baselineDimensions: { width: baseline.width, height: baseline.height },
        currentDimensions: { width: current.width, height: current.height }
      };
    }
    
    // Create diff image
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    
    // Compare images
    const numDiffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      baseline.width,
      baseline.height,
      comparisonOptions
    );
    
    // Calculate diff percentage
    const totalPixels = baseline.width * baseline.height;
    const diffPercentage = (numDiffPixels / totalPixels) * 100;
    
    // Save diff image
    fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));
    
    // Prepare results
    const result = {
      baselineImagePath,
      currentImagePath,
      diffImagePath: diffOutputPath,
      width: baseline.width,
      height: baseline.height,
      diffPixelCount: numDiffPixels,
      totalPixels,
      diffPercentage,
      hasDifferences: numDiffPixels > 0,
      dimensionMismatch: false
    };
    
    return result;
  } catch (error) {
    console.error(`Error comparing images: ${error.message}`);
    
    // Create an empty diff with a simple message
    const diff = new PNG({ width: 400, height: 200 });
    fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));
    
    // Return error result
    return {
      baselineImagePath,
      currentImagePath,
      diffImagePath: diffOutputPath,
      width: 400,
      height: 200,
      diffPixelCount: 0,
      totalPixels: 400 * 200,
      diffPercentage: 0,
      hasDifferences: false,
      error: error.message
    };
  }
}

/**
 * Compares all baseline and current screenshots
 * 
 * @param {number} threshold - Threshold for pixel difference (0-1)
 * @param {Object} directories - Optional paths to baseline and current directories
 * @returns {Array} - Array of comparison results
 */
async function compareAllScreenshots(threshold = 0.1, directories = null) {
  // Ensure results directory exists
  await ensureResultsDir();
  
  // Get screenshot directories
  const { 
    getCurrentDirectories, 
    ensureScreenshotDir 
  } = require('./screenshot');
  
  // Get directory paths - either use provided or get current
  const dirs = directories || await ensureScreenshotDir();
  
  const baselineDir = dirs.baselineDir || path.join(SCREENSHOT_DIR, 'baseline');
  const currentDir = dirs.currentDir;
  const diffDir = dirs.diffDir;
  
  // Ensure diff directory exists
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  
  const results = [];
  
  // List of screenshot pairs to compare
  const screenshotTypes = ['full', 'header', 'main', 'form'];
  
  // Compare each pair
  for (const type of screenshotTypes) {
    const baselinePath = path.join(baselineDir, `baseline-${type}.png`);
    const currentPath = path.join(currentDir, `current-${type}.png`);
    const diffPath = path.join(diffDir, `diff-${type}.png`);
    
    // Check if both files exist
    if (!fs.existsSync(baselinePath)) {
      console.error(`Baseline image not found: ${baselinePath}`);
      continue;
    }
    
    if (!fs.existsSync(currentPath)) {
      console.error(`Current image not found: ${currentPath}`);
      continue;
    }
    
    try {
      // Compare images
      const result = await compareImages(
        baselinePath,
        currentPath,
        diffPath,
        { threshold }
      );
      
      results.push({
        name: type,
        ...result
      });
  
      if (result.dimensionMismatch) {
        console.log(`Dimension mismatch between baseline-${type}.png and current-${type}.png`);
      } else if (result.error) {
        console.log(`Error comparing baseline-${type}.png with current-${type}.png: ${result.error}`);
      } else {
        console.log(`Compared baseline-${type}.png with current-${type}.png:`);
        console.log(`  Differences: ${result.diffPixelCount} pixels (${result.diffPercentage.toFixed(2)}%)`);
      }
    } catch (error) {
      console.error(`Error comparing baseline-${type}.png with current-${type}.png:`, error.message);
    }
  }
  
  // Generate summary report
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportPath = path.join(RESULTS_DIR, `comparison-report-${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp,
    results,
    directories: {
      baselineDir,
      currentDir,
      diffDir
    },
    summary: {
      totalComparisons: results.length,
      totalDifferences: results.reduce((sum, result) => sum + (result.diffPixelCount || 0), 0),
      averageDiffPercentage: results.reduce((sum, result) => sum + (result.diffPercentage || 0), 0) / results.length
    }
  }, null, 2));
  
  console.log(`Comparison report saved to: ${reportPath}`);
  
  return results;
}

/**
 * Compares specific baseline and current screenshots
 * 
 * @param {string} name - Name of the screenshot (without extension)
 * @param {number} threshold - Threshold for pixel difference (0-1)
 * @returns {Object} - Comparison result
 */
async function compareSpecificScreenshot(name, threshold = 0.1) {
  // Ensure results directory exists
  await ensureResultsDir();
  
  const baselinePath = path.join(SCREENSHOT_DIR, `baseline-${name}.png`);
  const currentPath = path.join(SCREENSHOT_DIR, `current-${name}.png`);
  const diffPath = path.join(RESULTS_DIR, `diff-${name}.png`);
  
  // Check if both files exist
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline image not found: ${baselinePath}`);
  }
  
  if (!fs.existsSync(currentPath)) {
    throw new Error(`Current image not found: ${currentPath}`);
  }
  
  // Compare images
  const result = await compareImages(
    baselinePath,
    currentPath,
    diffPath,
    { threshold }
  );
  
  console.log(`Compared baseline-${name}.png with current-${name}.png:`);
  console.log(`  Differences: ${result.diffPixels} pixels (${result.diffPercentage.toFixed(2)}%)`);
  
  return result;
}

// Export functions
module.exports = {
  compareImages,
  compareAllScreenshots,
  compareSpecificScreenshot
};

// If this script is run directly, compare all screenshots
if (require.main === module) {
  // Check for command line args
  const args = process.argv.slice(2);
  
  if (args.includes('--specific')) {
    const name = args[args.indexOf('--specific') + 1];
    if (name) {
      compareSpecificScreenshot(name);
    } else {
      console.error('Please provide a name after --specific');
    }
  } else {
    // Default to comparing all screenshots
    compareAllScreenshots();
  }
}
