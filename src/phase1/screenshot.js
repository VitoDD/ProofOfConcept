/**
 * screenshot.js
 * 
 * Utility for capturing screenshots of web pages using Puppeteer.
 * This script can capture screenshots of the entire page or specific elements.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Base URL of the test application
const BASE_URL = 'http://localhost:3000';

// Directory for storing screenshots
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');
const BASELINE_DIR = path.join(SCREENSHOT_DIR, 'baseline');
let CURRENT_DIR = null; // Will be set dynamically with timestamp

/**
 * Compatibility helper for Puppeteer API changes
 * Handles waitForTimeout -> waitForDelay transition
 */
async function waitFor(page, milliseconds) {
  try {
    // Try new API first (Puppeteer v21+)
    if (typeof page.waitForDelay === 'function') {
      await page.waitForDelay(milliseconds);
    } else if (typeof page.waitForTimeout === 'function') {
      // Fallback to old API (Puppeteer v20 and below)
      await page.waitForTimeout(milliseconds);
    } else {
      // Fallback to basic timeout
      await new Promise(resolve => setTimeout(resolve, milliseconds));
    }
  } catch (error) {
    console.warn(`Wait function failed, using basic timeout: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

/**
 * Ensures the screenshots directory structure exists
 */
async function ensureScreenshotDir() {
  // Create main screenshots directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  // Create baseline directory
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }
  
  // Create current directory with timestamp
  if (!CURRENT_DIR) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    CURRENT_DIR = path.join(SCREENSHOT_DIR, 'current', timestamp);
    
    if (!fs.existsSync(CURRENT_DIR)) {
      fs.mkdirSync(CURRENT_DIR, { recursive: true });
    }
    
    // Also create matching diff directory
    const diffDir = path.join(SCREENSHOT_DIR, 'diff', timestamp);
    if (!fs.existsSync(diffDir)) {
      fs.mkdirSync(diffDir, { recursive: true });
    }
  }
  
  return {
    screenshotDir: SCREENSHOT_DIR,
    baselineDir: BASELINE_DIR,
    currentDir: CURRENT_DIR,
    diffDir: path.join(SCREENSHOT_DIR, 'diff', path.basename(CURRENT_DIR))
  };
}

/**
 * Captures a screenshot of the entire webpage
 * 
 * @param {string} url - URL to capture (defaults to BASE_URL)
 * @param {string} name - Name of the screenshot (without extension)
 * @param {Object} options - Additional options for screenshot
 * @returns {Promise<string>} - Path to the saved screenshot
 */
async function captureFullPageScreenshot(url = BASE_URL, name = 'baseline', options = {}) {
  // Ensure directory exists and get paths
  const dirs = await ensureScreenshotDir();
  
  // Determine the appropriate output directory
  let outputDir = dirs.currentDir;
  if (name.startsWith('baseline-')) {
    outputDir = dirs.baselineDir;
  }
  
  // Set default options
  const defaultOptions = {
    fullPage: true,
    type: 'png',
    omitBackground: false
  };
  
  const screenshotOptions = { ...defaultOptions, ...options };
  
  // Start browser and open new page
  const browser = await puppeteer.launch({ 
    headless: 'new',  // Use new headless mode
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
      '--single-process', // Prevent multi-process issues in CI
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewport({ 
    width: 1280, 
    height: 800,
    deviceScaleFactor: 1
  });
  
  // Navigate to URL
  await page.goto(url, { 
    waitUntil: 'networkidle2',  // Wait until page is fully loaded
    timeout: 30000
  });
  
  // Allow additional time for any animations or dynamic content to load
  await waitFor(page, 1000);
  
  // Capture screenshot
  const screenshotPath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ 
    path: screenshotPath,
    ...screenshotOptions
  });
  
  // Close browser
  await browser.close();
  
  console.log(`Screenshot captured: ${screenshotPath}`);
  
  return screenshotPath;
}

/**
 * Captures a screenshot of a specific element on the webpage
 * 
 * @param {string} selector - CSS selector for the element to capture
 * @param {string} url - URL to capture (defaults to BASE_URL)
 * @param {string} name - Name of the screenshot (without extension)
 * @returns {Promise<string|boolean>} - Path to the saved screenshot or false if element not found
 */
async function captureElementScreenshot(selector, url = BASE_URL, name) {
  // Ensure directory exists and get paths
  const dirs = await ensureScreenshotDir();
  
  // Generate screenshot name if not provided
  const screenshotName = name || `element-${selector.replace(/[^a-zA-Z0-9]/g, '-')}`;
  
  // Determine the appropriate output directory
  let outputDir = dirs.currentDir;
  if (screenshotName.startsWith('baseline-')) {
    outputDir = dirs.baselineDir;
  }
  
  const screenshotPath = path.join(outputDir, `${screenshotName}.png`);
  
  // Start browser and open new page
  const browser = await puppeteer.launch({ 
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
      '--single-process', // Prevent multi-process issues in CI
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ 
      width: 1280, 
      height: 800,
      deviceScaleFactor: 1
    });
    
    // Navigate to URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Allow additional time for any animations or dynamic content to load
    await waitFor(page, 1000);
    
    // Try to wait for the selector with a reasonable timeout
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 10000 });
    } catch (selectorError) {
      console.warn(`Element not found: ${selector} - ${selectorError.message}`);
      
      // Create an empty screenshot as a placeholder to prevent comparison errors
      const emptyScreenshot = await page.screenshot({ 
        path: screenshotPath,
        clip: {
          x: 0,
          y: 0,
          width: 100,
          height: 100
        },
        type: 'png'
      });
      
      await browser.close();
      return false;
    }
    
    // Get element
    const element = await page.$(selector);
    
    if (!element) {
      console.warn(`Element found but could not be selected: ${selector}`);
      
      // Create an empty screenshot as a placeholder
      const emptyScreenshot = await page.screenshot({ 
        path: screenshotPath,
        clip: {
          x: 0,
          y: 0,
          width: 100,
          height: 100
        },
        type: 'png'
      });
      
      await browser.close();
      return false;
    }
    
    // Capture element screenshot
    await element.screenshot({ 
      path: screenshotPath,
      type: 'png'
    });
    
    console.log(`Screenshot captured: ${screenshotPath}`);
    return screenshotPath;
    
  } catch (error) {
    console.warn(`Unable to capture screenshot for ${selector}: ${error.message}`);
    return false;
  } finally {
    // Close browser
    await browser.close();
  }
}

/**
 * Captures baseline screenshots of the test application
 * This includes the full page and key elements
 */
async function captureBaselineScreenshots() {
  try {
    // Ensure directory exists and get paths
    const dirs = await ensureScreenshotDir();
    
    // Capture full page
    await captureFullPageScreenshot(BASE_URL, 'baseline-full');
    
    // Capture key elements that match our actual HTML structure
    const headerCaptured = await captureElementScreenshot('header', BASE_URL, 'baseline-header');
    const mainCaptured = await captureElementScreenshot('main', BASE_URL, 'baseline-main');
    const formCaptured = await captureElementScreenshot('form#demo-form', BASE_URL, 'baseline-form');
    
    if (headerCaptured && mainCaptured && formCaptured) {
      console.log('All baseline screenshots captured successfully');
    } else {
      console.log('Some elements could not be captured, proceeding with partially captured screenshots');
    }
    
    return {
      baselineDir: dirs.baselineDir
    };
  } catch (error) {
    console.error('Error capturing baseline screenshots:', error);
    return false;
  }
}

/**
 * Captures current screenshots for comparison with baseline
 */
async function captureCurrentScreenshots() {
  try {
    // Ensure directory exists and get paths
    const dirs = await ensureScreenshotDir();
    
    // Capture full page
    await captureFullPageScreenshot(BASE_URL, 'current-full');
    
    // Capture key elements that match our actual HTML structure
    const headerCaptured = await captureElementScreenshot('header', BASE_URL, 'current-header');
    const mainCaptured = await captureElementScreenshot('main', BASE_URL, 'current-main');
    const formCaptured = await captureElementScreenshot('form#demo-form', BASE_URL, 'current-form');
    
    if (headerCaptured && mainCaptured && formCaptured) {
      console.log('All current screenshots captured successfully');
    } else {
      console.log('Some elements could not be captured, proceeding with partially captured screenshots');
    }
    
    return {
      currentDir: dirs.currentDir,
      diffDir: dirs.diffDir
    };
  } catch (error) {
    console.error('Error capturing current screenshots:', error);
    return false;
  }
}

// Get the current screenshot directory with timestamp
function getCurrentDirectories() {
  if (!CURRENT_DIR) {
    // Initialize the directories
    ensureScreenshotDir();
  }
  
  return {
    currentDir: CURRENT_DIR,
    diffDir: path.join(SCREENSHOT_DIR, 'diff', path.basename(CURRENT_DIR))
  };
}

// Export functions
module.exports = {
  captureFullPageScreenshot,
  captureElementScreenshot,
  captureBaselineScreenshots,
  captureCurrentScreenshots,
  getCurrentDirectories,
  ensureScreenshotDir
};

// If this script is run directly, capture baseline screenshots
if (require.main === module) {
  // Check for command line args
  const args = process.argv.slice(2);
  
  if (args.includes('--current')) {
    captureCurrentScreenshots();
  } else if (args.includes('--element')) {
    const selector = args[args.indexOf('--element') + 1];
    if (selector) {
      captureElementScreenshot(selector);
    } else {
      console.error('Please provide a selector after --element');
    }
  } else {
    // Default to capturing baseline screenshots
    captureBaselineScreenshots();
  }
}
