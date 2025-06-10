/**
 * fix-verifier.js
 * 
 * Verifies that applied fixes resolve the visual issues
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { startServer } = require('../server');
const logger = require('../utils/logger');
const { getConfig } = require('../utils/config');
const puppeteer = require('puppeteer');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

// Try to load the image paths utilities
try {
  var imagePaths = require('./utils/image-paths');
} catch (error) {
  logger.warn(`Could not load image-paths utilities: ${error.message}. Using built-in fallbacks.`);
  imagePaths = null;
}

/**
 * FixVerifier class responsible for verifying that applied fixes resolve visual issues
 */
class FixVerifier {
  /**
   * Creates a new FixVerifier instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.screenshotsDir = options.screenshotsDir || path.join(process.cwd(), 'screenshots');
    this.verificationDir = options.verificationDir || path.join(this.screenshotsDir, 'verification');
    this.threshold = options.threshold || 0.1;
    this.fixApplier = options.fixApplier;
    
    logger.info(`Initialized FixVerifier with threshold ${this.threshold}`);
  }
  
  /**
   * Verify a fix by taking new screenshots and comparing them to baselines
   * 
   * @param {Object} issue - Issue to verify
   * @param {Object} fixResult - Result of applying the fix
   * @returns {Promise<Object>} - Verification result
   */
  async verifyFix(issue, fixResult) {
    logger.info(`Verifying fix for issue in ${issue.comparisonResult.name}`);
    
    // Clone server to avoid interference
    let server = null;
    let browser = null;
    
    try {
      // Ensure verification directory exists
      await fs.mkdir(this.verificationDir, { recursive: true });
      
      // Start a new server instance
      const port = getConfig('server.port', 3000) + 1; // Use a different port to avoid conflicts
      const host = getConfig('server.host', 'localhost');
      
      server = await startServer(port, host);
      logger.info(`Started verification server on port ${port}`);
      
      // Launch browser
      browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      const page = await browser.newPage();
      
      // Set viewport to match the original issue
      await page.setViewport({
        width: issue.comparisonResult.width,
        height: issue.comparisonResult.height
      });
      
      // Get the URL to verify
      const url = `http://${host}:${port}/${issue.comparisonResult.name}`;
      
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Take a screenshot
      const verificationPath = path.join(this.verificationDir, `${issue.comparisonResult.name}.png`);
      await page.screenshot({ path: verificationPath, fullPage: true });
      
      logger.info(`Captured verification screenshot at ${verificationPath}`);
      
      // Compare with baseline
      const comparisonResult = await this._compareWithBaseline(
        issue.comparisonResult.baselineImagePath,
        verificationPath,
        issue.comparisonResult.name
      );
      
      // Determine if fix was successful
      const isFixSuccessful = !comparisonResult.hasDifferences || 
        (comparisonResult.diffPercentage < this.threshold);
      
      logger.info(`Fix verification result: ${isFixSuccessful ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`Difference percentage: ${comparisonResult.diffPercentage.toFixed(2)}%`);
      
      const result = {
        status: isFixSuccessful ? 'success' : 'failure',
        originalIssue: issue.comparisonResult.name,
        fixResult,
        verificationScreenshotPath: verificationPath,
        diffPercentage: comparisonResult.diffPercentage,
        diffImagePath: comparisonResult.diffImagePath,
        threshold: this.threshold
      };
      
      return result;
    } catch (error) {
      logger.error(`Error verifying fix: ${error.message}`);
      
      return {
        status: 'error',
        originalIssue: issue.comparisonResult.name,
        fixResult,
        error: error.message
      };
    } finally {
      // Close browser if opened
      if (browser) {
        await browser.close();
      }
      
      // Close server if started
      if (server) {
        server.close();
        logger.info('Verification server closed');
      }
    }
  }
  
  /**
   * Compare a verification screenshot with the baseline
   * 
   * @param {string} baselinePath - Path to baseline image
   * @param {string} verificationPath - Path to verification image
   * @param {string} pageName - Name of the page being compared
   * @returns {Promise<Object>} - Comparison result
   * @private
   */
  async _compareWithBaseline(baselinePath, verificationPath, pageName) {
    logger.info(`Comparing verification screenshot with baseline for ${pageName}`);
    
    try {
      // Use robust path handling if available
      let baselineImageBuffer;
      try {
        baselineImageBuffer = await fs.readFile(baselinePath);
      } catch (error) {
        // Try alternative paths if original path fails
        logger.warn(`Could not find baseline at ${baselinePath}, trying alternatives`);
        
        const alternativePaths = [
          path.join(process.cwd(), 'screenshots', 'baseline', `baseline-${pageName}.png`),
          path.join(process.cwd(), 'reports', `baseline-${pageName}`),
          path.join(process.cwd(), 'screenshots', 'baseline', pageName, `baseline-${pageName}.png`)
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          try {
            if (fsSync.existsSync(altPath)) {
              baselineImageBuffer = await fs.readFile(altPath);
              logger.info(`Found baseline at alternative path: ${altPath}`);
              found = true;
              break;
            }
          } catch (innerError) {
            // Continue to next path
          }
        }
        
        if (!found) {
          throw new Error(`Could not find baseline image for ${pageName} at any expected location`);
        }
      }
      
      // Read verification image
      const verificationImg = PNG.sync.read(
        await fs.readFile(verificationPath)
      );
      
      // Read baseline image
      const baselineImg = PNG.sync.read(baselineImageBuffer);
      
      // Ensure images have the same dimensions
      if (baselineImg.width !== verificationImg.width || baselineImg.height !== verificationImg.height) {
        logger.warn(`Image dimensions don't match. Baseline: ${baselineImg.width}x${baselineImg.height}, Verification: ${verificationImg.width}x${verificationImg.height}`);
        
        // Resize one of the images (simple approach - use baseline dimensions)
        // In a production system, you would use a more sophisticated approach
        const resizedVerification = new PNG({
          width: baselineImg.width,
          height: baselineImg.height
        });
        
        // This is a very basic resize that might distort the image
        // A better approach would be to use a proper image resizing library
        for (let y = 0; y < baselineImg.height; y++) {
          for (let x = 0; x < baselineImg.width; x++) {
            const idx = (baselineImg.width * y + x) << 2;
            
            // Map coordinates to verification image (simple scaling)
            const srcX = Math.floor(x * verificationImg.width / baselineImg.width);
            const srcY = Math.floor(y * verificationImg.height / baselineImg.height);
            const srcIdx = (verificationImg.width * srcY + srcX) << 2;
            
            // Copy pixel
            resizedVerification.data[idx] = verificationImg.data[srcIdx];
            resizedVerification.data[idx + 1] = verificationImg.data[srcIdx + 1];
            resizedVerification.data[idx + 2] = verificationImg.data[srcIdx + 2];
            resizedVerification.data[idx + 3] = verificationImg.data[srcIdx + 3];
          }
        }
        
        return this._performComparison(baselineImg, resizedVerification, pageName);
      }
      
      return this._performComparison(baselineImg, verificationImg, pageName);
    } catch (error) {
      logger.error(`Error comparing images: ${error.message}`);
      
      return {
        hasDifferences: true,
        diffPercentage: 100,
        diffPixelCount: 0,
        diffImagePath: null,
        error: error.message
      };
    }
  }
  
  /**
   * Perform image comparison using pixelmatch
   * 
   * @param {PNG} img1 - First image (baseline)
   * @param {PNG} img2 - Second image (verification)
   * @param {string} pageName - Name of the page being compared
   * @returns {Object} - Comparison result
   * @private
   */
  async _performComparison(img1, img2, pageName) {
    // Create diff image
    const diff = new PNG({ width: img1.width, height: img1.height });
    
    // Compare images
    const pixelCount = img1.width * img1.height;
    const diffPixelCount = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      img1.width,
      img1.height,
      { threshold: this.threshold }
    );
    
    const diffPercentage = (diffPixelCount / pixelCount) * 100;
    const hasDifferences = diffPercentage > this.threshold;
    
    // Save diff image
    const diffImagePath = path.join(this.verificationDir, `diff-${pageName}.png`);
    await fs.writeFile(diffImagePath, PNG.sync.write(diff));
    
    logger.info(`Comparison result: ${diffPercentage.toFixed(2)}% different (${diffPixelCount} pixels)`);
    
    return {
      hasDifferences,
      diffPercentage,
      diffPixelCount,
      width: img1.width,
      height: img1.height,
      diffImagePath
    };
  }
  
  /**
   * Revert a fix if verification fails
   * 
   * @param {Object} fixResult - Result of applying the fix
   * @returns {Promise<boolean>} - Whether the revert was successful
   */
  async revertFix(fixResult) {
    if (!this.fixApplier) {
      logger.warn('No fix applier available for reverting fixes');
      return false;
    }
    
    try {
      if (Array.isArray(fixResult)) {
        // Multiple fixes - get unique file paths
        const filePaths = [...new Set(
          fixResult
            .filter(r => r.status === 'success')
            .map(r => r.filePath)
        )];
        
        // Revert each file
        let allSuccessful = true;
        for (const filePath of filePaths) {
          const success = await this.fixApplier.restoreFromBackup(filePath);
          if (!success) {
            allSuccessful = false;
          }
        }
        
        return allSuccessful;
      } else {
        // Single fix
        return await this.fixApplier.restoreFromBackup(fixResult.filePath);
      }
    } catch (error) {
      logger.error(`Error reverting fix: ${error.message}`);
      return false;
    }
  }
}

module.exports = { FixVerifier };
