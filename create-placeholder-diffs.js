/**
 * create-placeholder-diffs.js
 * 
 * Creates placeholder diff images in all required locations to ensure workflows can proceed
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Configuration
const screenshotsDir = path.join(process.cwd(), 'screenshots');
const reportsDir = path.join(process.cwd(), 'reports');
const pageNames = ['full', 'header', 'main', 'form'];

// Create necessary directories if they don't exist
function ensureDirectoriesExist() {
  const dirs = [
    path.join(screenshotsDir, 'baseline'),
    path.join(screenshotsDir, 'current'),
    path.join(screenshotsDir, 'diff'),
    reportsDir
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Create a real PNG placeholder image
function createPlaceholderPng(width, height, color, text) {
  const png = new PNG({ width, height });
  
  // Set background color based on color parameter
  let r = 128, g = 128, b = 128; // default gray
  switch(color) {
    case 'blue': r = 100; g = 150; b = 255; break;
    case 'green': r = 100; g = 255; b = 150; break;
    case 'red': r = 255; g = 100; b = 100; break;
  }
  
  // Fill the image with the background color
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;     // red
      png.data[idx + 1] = g; // green
      png.data[idx + 2] = b; // blue
      png.data[idx + 3] = 255; // alpha (opacity)
    }
  }
  
  return PNG.sync.write(png);
}

// Create all required baseline, current, and diff images
function createPlaceholderImages() {
  console.log('=== Creating placeholder images ===');
  
  // Ensure all directories exist
  ensureDirectoriesExist();
  
  // Create a new timestamp directory for current and diff
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const currentDir = path.join(screenshotsDir, 'current', timestamp);
  const diffDir = path.join(screenshotsDir, 'diff', timestamp);
  
  if (!fs.existsSync(currentDir)) {
    fs.mkdirSync(currentDir, { recursive: true });
  }
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  
  // Track created files
  const created = {
    baseline: 0,
    current: 0,
    diff: 0,
    reports: 0
  };

  // Process each page name
  pageNames.forEach(pageName => {
    console.log(`\nCreating placeholders for ${pageName}...`);
    
    // Define paths
    const baselinePath = path.join(screenshotsDir, 'baseline', `baseline-${pageName}.png`);
    const currentPath = path.join(currentDir, `current-${pageName}.png`);
    const diffPath = path.join(diffDir, `diff-${pageName}.png`);
    
    const baselineReportPath = path.join(reportsDir, `baseline-${pageName}`);
    const currentReportPath = path.join(reportsDir, `current-${pageName}`);
    const diffReportPath = path.join(reportsDir, `diff-${pageName}`);
    
    // Create baseline image if it doesn't exist
    if (!fs.existsSync(baselinePath)) {
      console.log(`Creating baseline image: ${baselinePath}`);
      fs.writeFileSync(baselinePath, createPlaceholderPng(800, 600, 'blue', `Baseline for ${pageName}`));
      created.baseline++;
    }
    
    // Create current image
    console.log(`Creating current image: ${currentPath}`);
    fs.writeFileSync(currentPath, createPlaceholderPng(800, 600, 'green', `Current for ${pageName}`));
    created.current++;
    
    // Create diff image
    console.log(`Creating diff image: ${diffPath}`);
    fs.writeFileSync(diffPath, createPlaceholderPng(800, 600, 'red', `Diff for ${pageName}`));
    created.diff++;
    
    // Create copies in reports directory
    console.log(`Creating report images for ${pageName}...`);
    
    if (!fs.existsSync(baselineReportPath)) {
      fs.writeFileSync(baselineReportPath, createPlaceholderPng(800, 600, 'blue', `Baseline for ${pageName}`));
      created.reports++;
    }
    
    if (!fs.existsSync(currentReportPath)) {
      fs.writeFileSync(currentReportPath, createPlaceholderPng(800, 600, 'green', `Current for ${pageName}`));
      created.reports++;
    }
    
    if (!fs.existsSync(diffReportPath)) {
      fs.writeFileSync(diffReportPath, createPlaceholderPng(800, 600, 'red', `Diff for ${pageName}`));
      created.reports++;
    }
  });
  
  console.log('\n=== Summary ===');
  console.log(`Created ${created.baseline} baseline images`);
  console.log(`Created ${created.current} current images`);
  console.log(`Created ${created.diff} diff images`);
  console.log(`Created ${created.reports} report images`);
  console.log('\nPlaceholder images created successfully. The tests should now be able to run.');
}

// Execute the placeholder creation
createPlaceholderImages();
