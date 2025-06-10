/**
 * screenshot.test.js
 * 
 * Tests for the screenshot capture utility.
 */

const fs = require('fs');
const path = require('path');
const { 
  captureFullPageScreenshot,
  captureElementScreenshot
} = require('../../src/phase1/screenshot');

// Test server URL
const TEST_URL = 'http://localhost:3000';

// Screenshot directory
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');

// Test timeout (increased for Puppeteer operations)
jest.setTimeout(30000);

describe('Screenshot Capture Utility', () => {
  
  // Check if server is running before tests
  beforeAll(async () => {
    // Try to access the server
    try {
      const response = await fetch(`${TEST_URL}/api/status`);
      if (!response.ok) {
        console.warn('Warning: Test server may not be running. Some tests may fail.');
      }
    } catch (error) {
      console.warn('Warning: Test server is not running. Tests will likely fail.');
    }
    
    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });
  
  // Remove test screenshots after tests
  afterAll(() => {
    // Clean up test screenshots
    try {
      const files = [
        path.join(SCREENSHOT_DIR, 'test-full.png'),
        path.join(SCREENSHOT_DIR, 'test-element.png')
      ];
      
      files.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    } catch (error) {
      console.error('Error cleaning up test screenshots:', error);
    }
  });
  
  test('captureFullPageScreenshot captures a full page screenshot', async () => {
    // Skip if server is not running
    try {
      await fetch(`${TEST_URL}/api/status`);
    } catch (error) {
      console.log('Skipping test - server not running');
      return;
    }
    
    const screenshotPath = await captureFullPageScreenshot(TEST_URL, 'test-full');
    
    // Check that the file exists and has content
    expect(fs.existsSync(screenshotPath)).toBe(true);
    
    const stats = fs.statSync(screenshotPath);
    expect(stats.size).toBeGreaterThan(0);
  });
  
  test('captureElementScreenshot captures a specific element', async () => {
    // Skip if server is not running
    try {
      await fetch(`${TEST_URL}/api/status`);
    } catch (error) {
      console.log('Skipping test - server not running');
      return;
    }
    
    const screenshotPath = await captureElementScreenshot('.hero', TEST_URL, 'test-element');
    
    // Check that the file exists and has content
    expect(fs.existsSync(screenshotPath)).toBe(true);
    
    const stats = fs.statSync(screenshotPath);
    expect(stats.size).toBeGreaterThan(0);
  });
  
  test('captureElementScreenshot throws error for non-existent element', async () => {
    // Skip if server is not running
    try {
      await fetch(`${TEST_URL}/api/status`);
    } catch (error) {
      console.log('Skipping test - server not running');
      return;
    }
    
    await expect(async () => {
      await captureElementScreenshot('.non-existent-element', TEST_URL);
    }).rejects.toThrow();
  });
});
