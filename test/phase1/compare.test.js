/**
 * compare.test.js
 * 
 * Tests for the image comparison utility.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { 
  compareImages 
} = require('../../src/phase1/compare');

// Paths for test images
const TEST_DIR = path.join(__dirname, '../../test/phase1/test-images');
const RESULTS_DIR = path.join(__dirname, '../../reports');

// Ensure directories exist
beforeAll(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  // Create test images if they don't exist
  createTestImages();
});

// Create test images for comparison
function createTestImages() {
  const width = 100;
  const height = 100;
  
  // Create identical images
  const identical1 = new PNG({ width, height });
  const identical2 = new PNG({ width, height });
  
  // Fill with white pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      identical1.data[idx] = 255;      // R
      identical1.data[idx + 1] = 255;  // G
      identical1.data[idx + 2] = 255;  // B
      identical1.data[idx + 3] = 255;  // A
      
      identical2.data[idx] = 255;      // R
      identical2.data[idx + 1] = 255;  // G
      identical2.data[idx + 2] = 255;  // B
      identical2.data[idx + 3] = 255;  // A
    }
  }
  
  // Create slightly different image
  const different = new PNG({ width, height });
  
  // Fill with white pixels, but add a red square in the middle
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      
      if (x >= 40 && x < 60 && y >= 40 && y < 60) {
        different.data[idx] = 255;      // R
        different.data[idx + 1] = 0;    // G
        different.data[idx + 2] = 0;    // B
        different.data[idx + 3] = 255;  // A
      } else {
        different.data[idx] = 255;      // R
        different.data[idx + 1] = 255;  // G
        different.data[idx + 2] = 255;  // B
        different.data[idx + 3] = 255;  // A
      }
    }
  }
  
  // Save the test images
  fs.writeFileSync(
    path.join(TEST_DIR, 'identical1.png'),
    PNG.sync.write(identical1)
  );
  
  fs.writeFileSync(
    path.join(TEST_DIR, 'identical2.png'),
    PNG.sync.write(identical2)
  );
  
  fs.writeFileSync(
    path.join(TEST_DIR, 'different.png'),
    PNG.sync.write(different)
  );
}

describe('Image Comparison Utility', () => {
  
  test('compareImages detects no differences between identical images', async () => {
    const baselinePath = path.join(TEST_DIR, 'identical1.png');
    const currentPath = path.join(TEST_DIR, 'identical2.png');
    const diffPath = path.join(RESULTS_DIR, 'test-identical-diff.png');
    
    const result = await compareImages(baselinePath, currentPath, diffPath);
    
    expect(result.diffPixels).toBe(0);
    expect(result.diffPercentage).toBe(0);
    expect(result.hasDifferences).toBe(false);
    
    // Check that diff file was created
    expect(fs.existsSync(diffPath)).toBe(true);
  });
  
  test('compareImages detects differences between different images', async () => {
    const baselinePath = path.join(TEST_DIR, 'identical1.png');
    const currentPath = path.join(TEST_DIR, 'different.png');
    const diffPath = path.join(RESULTS_DIR, 'test-different-diff.png');
    
    const result = await compareImages(baselinePath, currentPath, diffPath);
    
    // The red square is 20x20 pixels (400 pixels total)
    expect(result.diffPixels).toBe(400);
    expect(result.diffPercentage).toBe(4);
    expect(result.hasDifferences).toBe(true);
    
    // Check that diff file was created
    expect(fs.existsSync(diffPath)).toBe(true);
  });
  
  test('compareImages throws error for non-existent images', async () => {
    const baselinePath = path.join(TEST_DIR, 'non-existent.png');
    const currentPath = path.join(TEST_DIR, 'identical1.png');
    const diffPath = path.join(RESULTS_DIR, 'test-error-diff.png');
    
    await expect(async () => {
      await compareImages(baselinePath, currentPath, diffPath);
    }).rejects.toThrow();
  });
});
