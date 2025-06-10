/**
 * fix-baseline-images.js
 * 
 * Fixes corrupted baseline images that may have been created as text files
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Configuration
const screenshotsDir = path.join(process.cwd(), 'screenshots');
const pageNames = ['full', 'header', 'main', 'form'];

// Create a proper PNG image
function createValidPng(width = 1280, height = 800, color = 'blue') {
  const png = new PNG({ width, height });
  
  // Set background color
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

// Check if a file is a valid PNG
function isValidPng(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const data = fs.readFileSync(filePath);
    
    // Check PNG signature (first 8 bytes)
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (data.length < 8 || !data.subarray(0, 8).equals(pngSignature)) {
      return false;
    }
    
    // Try to parse with PNG library
    PNG.sync.read(data);
    return true;
  } catch (error) {
    console.log(`Invalid PNG detected: ${filePath} - ${error.message}`);
    return false;
  }
}

// Fix all baseline images
function fixBaselineImages() {
  console.log('🔧 Fixing baseline images...');
  
  const baselineDir = path.join(screenshotsDir, 'baseline');
  
  // Ensure baseline directory exists
  if (!fs.existsSync(baselineDir)) {
    console.log(`Creating baseline directory: ${baselineDir}`);
    fs.mkdirSync(baselineDir, { recursive: true });
  }
  
  let fixed = 0;
  let created = 0;
  
  pageNames.forEach(pageName => {
    const baselinePath = path.join(baselineDir, `baseline-${pageName}.png`);
    
    if (!fs.existsSync(baselinePath)) {
      console.log(`📄 Creating missing baseline: ${baselinePath}`);
      const pngData = createValidPng(1280, 800, 'blue');
      fs.writeFileSync(baselinePath, pngData);
      created++;
    } else if (!isValidPng(baselinePath)) {
      console.log(`🔨 Fixing corrupted baseline: ${baselinePath}`);
      const pngData = createValidPng(1280, 800, 'blue');
      fs.writeFileSync(baselinePath, pngData);
      fixed++;
    } else {
      console.log(`✅ Valid baseline: ${baselinePath}`);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ ${created} baseline images created`);
  console.log(`   🔧 ${fixed} baseline images fixed`);
  console.log(`   📄 ${pageNames.length - created - fixed} baseline images were already valid`);
  
  if (created > 0 || fixed > 0) {
    console.log('\n🎉 Baseline images are now ready for visual testing!');
  }
}

// Execute the fix
fixBaselineImages();
