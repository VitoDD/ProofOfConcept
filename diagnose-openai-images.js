/**
 * diagnose-openai-images.js
 * 
 * Script to diagnose issues with images being sent to OpenAI
 */

const fs = require('fs');
const path = require('path');
const { imageToBase64WithMime } = require('./src/openai/openai-client');

// Setup logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARNING] ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${msg}`)
};

/**
 * Find all screenshots in directories
 */
async function findAllScreenshots() {
  const baseDir = path.join(process.cwd(), 'screenshots');
  
  logger.info(`Searching for screenshots in ${baseDir}...`);
  
  // Check if screenshots directory exists
  if (!fs.existsSync(baseDir)) {
    logger.error(`Screenshots directory not found: ${baseDir}`);
    return null;
  }
  
  // Find all baseline screenshots
  const baselineDir = path.join(baseDir, 'baseline');
  const baselineFiles = fs.existsSync(baselineDir) 
    ? fs.readdirSync(baselineDir).filter(f => f.endsWith('.png'))
    : [];
  
  logger.info(`Found ${baselineFiles.length} baseline screenshots`);
  
  // Find all current screenshots (might be in subdirectories)
  const currentDir = path.join(baseDir, 'current');
  let currentFiles = [];
  
  if (fs.existsSync(currentDir)) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    // Check for timestamp directories
    const timestampDirs = entries.filter(e => e.isDirectory() && /\d{4}-\d{2}-\d{2}T/.test(e.name));
    
    if (timestampDirs.length > 0) {
      // Use most recent timestamp directory
      const latestDir = timestampDirs.sort((a, b) => b.name.localeCompare(a.name))[0];
      const latestPath = path.join(currentDir, latestDir.name);
      
      currentFiles = fs.readdirSync(latestPath)
        .filter(f => f.endsWith('.png'))
        .map(f => ({ name: f, path: path.join(latestPath, f) }));
      
      logger.info(`Found ${currentFiles.length} current screenshots in timestamp directory: ${latestDir.name}`);
    } else {
      // Check for screenshots directly in current directory
      currentFiles = fs.readdirSync(currentDir)
        .filter(f => f.endsWith('.png'))
        .map(f => ({ name: f, path: path.join(currentDir, f) }));
      
      logger.info(`Found ${currentFiles.length} current screenshots directly in current directory`);
    }
  } else {
    logger.error(`Current screenshots directory not found: ${currentDir}`);
  }
  
  // Find diff images
  const diffDir = path.join(baseDir, 'diff');
  let diffFiles = [];
  
  if (fs.existsSync(diffDir)) {
    const entries = fs.readdirSync(diffDir, { withFileTypes: true });
    
    // Check for timestamp directories
    const timestampDirs = entries.filter(e => e.isDirectory() && /\d{4}-\d{2}-\d{2}T/.test(e.name));
    
    if (timestampDirs.length > 0) {
      // Use most recent timestamp directory
      const latestDir = timestampDirs.sort((a, b) => b.name.localeCompare(a.name))[0];
      const latestPath = path.join(diffDir, latestDir.name);
      
      diffFiles = fs.readdirSync(latestPath)
        .filter(f => f.endsWith('.png'))
        .map(f => ({ name: f, path: path.join(latestPath, f) }));
      
      logger.info(`Found ${diffFiles.length} diff images in timestamp directory: ${latestDir.name}`);
    } else {
      // Check for diffs directly in diff directory
      diffFiles = fs.readdirSync(diffDir)
        .filter(f => f.endsWith('.png'))
        .map(f => ({ name: f, path: path.join(diffDir, f) }));
      
      logger.info(`Found ${diffFiles.length} diff images directly in diff directory`);
    }
  } else {
    logger.warn(`Diff directory not found: ${diffDir}`);
  }
  
  // Check reports directory for any images
  const reportsDir = path.join(process.cwd(), 'reports');
  let reportFiles = [];
  
  if (fs.existsSync(reportsDir)) {
    reportFiles = fs.readdirSync(reportsDir)
      .filter(f => f.endsWith('.png'))
      .map(f => ({ name: f, path: path.join(reportsDir, f) }));
    
    logger.info(`Found ${reportFiles.length} image files in reports directory`);
  }
  
  return {
    baseline: baselineFiles.map(f => path.join(baselineDir, f)),
    current: currentFiles.map(f => f.path),
    diff: diffFiles.map(f => f.path),
    reports: reportFiles.map(f => f.path)
  };
}

/**
 * Check if all image files are readable and valid
 */
async function validateImages(images) {
  logger.info('Validating image files...');
  
  const results = {
    baseline: [],
    current: [],
    diff: [],
    reports: []
  };
  
  // Check baseline images
  for (const imagePath of images.baseline) {
    try {
      const stats = fs.statSync(imagePath);
      const isValid = stats.isFile() && stats.size > 0;
      
      results.baseline.push({
        path: imagePath,
        exists: true,
        size: stats.size,
        isValid
      });
    } catch (error) {
      results.baseline.push({
        path: imagePath,
        exists: false,
        error: error.message
      });
    }
  }
  
  // Check current images
  for (const imagePath of images.current) {
    try {
      const stats = fs.statSync(imagePath);
      const isValid = stats.isFile() && stats.size > 0;
      
      results.current.push({
        path: imagePath,
        exists: true,
        size: stats.size,
        isValid
      });
    } catch (error) {
      results.current.push({
        path: imagePath,
        exists: false,
        error: error.message
      });
    }
  }
  
  // Check diff images
  for (const imagePath of images.diff) {
    try {
      const stats = fs.statSync(imagePath);
      const isValid = stats.isFile() && stats.size > 0;
      
      results.diff.push({
        path: imagePath,
        exists: true,
        size: stats.size,
        isValid
      });
    } catch (error) {
      results.diff.push({
        path: imagePath,
        exists: false,
        error: error.message
      });
    }
  }
  
  // Check report images
  for (const imagePath of images.reports) {
    try {
      const stats = fs.statSync(imagePath);
      const isValid = stats.isFile() && stats.size > 0;
      
      results.reports.push({
        path: imagePath,
        exists: true,
        size: stats.size,
        isValid
      });
    } catch (error) {
      results.reports.push({
        path: imagePath,
        exists: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Test image base64 conversion
 */
async function testImageConversion(validImages) {
  logger.info('Testing image conversion for OpenAI...');
  
  const results = {
    baseline: [],
    current: [],
    diff: []
  };
  
  // Test a sample of each type
  const sampleBaseline = validImages.baseline.find(img => img.isValid);
  const sampleCurrent = validImages.current.find(img => img.isValid);
  const sampleDiff = validImages.diff.find(img => img.isValid);
  
  if (sampleBaseline) {
    try {
      const base64Image = await imageToBase64WithMime(sampleBaseline.path);
      const imageSize = Math.round(base64Image.length / 1024); // Size in KB
      
      results.baseline = {
        path: sampleBaseline.path,
        success: true,
        size: imageSize,
        preview: base64Image.substring(0, 100) + '...'
      };
    } catch (error) {
      results.baseline = {
        path: sampleBaseline.path,
        success: false,
        error: error.message
      };
    }
  }
  
  if (sampleCurrent) {
    try {
      const base64Image = await imageToBase64WithMime(sampleCurrent.path);
      const imageSize = Math.round(base64Image.length / 1024); // Size in KB
      
      results.current = {
        path: sampleCurrent.path,
        success: true,
        size: imageSize,
        preview: base64Image.substring(0, 100) + '...'
      };
    } catch (error) {
      results.current = {
        path: sampleCurrent.path,
        success: false,
        error: error.message
      };
    }
  }
  
  if (sampleDiff) {
    try {
      const base64Image = await imageToBase64WithMime(sampleDiff.path);
      const imageSize = Math.round(base64Image.length / 1024); // Size in KB
      
      results.diff = {
        path: sampleDiff.path,
        success: true,
        size: imageSize,
        preview: base64Image.substring(0, 100) + '...'
      };
    } catch (error) {
      results.diff = {
        path: sampleDiff.path,
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Main diagnostic function
 */
async function runDiagnostics() {
  console.log('--- OpenAI Image Diagnostics ---');
  console.log('Running diagnostic checks to verify image handling for OpenAI API...');
  
  // Find all screenshots
  const images = await findAllScreenshots();
  if (!images) {
    logger.error('Failed to find screenshots. Please make sure you have run the tests at least once.');
    return;
  }
  
  // Validate images
  const validationResults = await validateImages(images);
  
  // Count valid/invalid images
  const validBaseline = validationResults.baseline.filter(img => img.isValid).length;
  const invalidBaseline = validationResults.baseline.length - validBaseline;
  
  const validCurrent = validationResults.current.filter(img => img.isValid).length;
  const invalidCurrent = validationResults.current.length - validCurrent;
  
  const validDiff = validationResults.diff.filter(img => img.isValid).length;
  const invalidDiff = validationResults.diff.length - validDiff;
  
  console.log('\n--- Image Validation Results ---');
  console.log(`Baseline: ${validBaseline} valid, ${invalidBaseline} invalid`);
  console.log(`Current: ${validCurrent} valid, ${invalidCurrent} invalid`);
  console.log(`Diff: ${validDiff} valid, ${invalidDiff} invalid`);
  
  // Test image conversion for valid images
  if (validBaseline > 0 || validCurrent > 0 || validDiff > 0) {
    const conversionResults = await testImageConversion({
      baseline: validationResults.baseline,
      current: validationResults.current,
      diff: validationResults.diff
    });
    
    console.log('\n--- Image Conversion Test ---');
    
    if (conversionResults.baseline.success) {
      console.log(`✅ Baseline conversion success: ${conversionResults.baseline.path}`);
      console.log(`   Size: ${conversionResults.baseline.size} KB`);
      console.log(`   Preview: ${conversionResults.baseline.preview}`);
    } else if (conversionResults.baseline.path) {
      console.log(`❌ Baseline conversion failed: ${conversionResults.baseline.path}`);
      console.log(`   Error: ${conversionResults.baseline.error}`);
    }
    
    if (conversionResults.current.success) {
      console.log(`✅ Current conversion success: ${conversionResults.current.path}`);
      console.log(`   Size: ${conversionResults.current.size} KB`);
      console.log(`   Preview: ${conversionResults.current.preview}`);
    } else if (conversionResults.current.path) {
      console.log(`❌ Current conversion failed: ${conversionResults.current.path}`);
      console.log(`   Error: ${conversionResults.current.error}`);
    }
    
    if (conversionResults.diff.success) {
      console.log(`✅ Diff conversion success: ${conversionResults.diff.path}`);
      console.log(`   Size: ${conversionResults.diff.size} KB`);
      console.log(`   Preview: ${conversionResults.diff.preview}`);
    } else if (conversionResults.diff.path) {
      console.log(`❌ Diff conversion failed: ${conversionResults.diff.path}`);
      console.log(`   Error: ${conversionResults.diff.error}`);
    }
  }
  
  // Print recommendations
  console.log('\n--- Recommendations ---');
  
  if (invalidBaseline > 0 || invalidCurrent > 0 || invalidDiff > 0) {
    console.log('⚠️ Some image files are missing or invalid. Try running the tests again to generate fresh screenshots.');
  }
  
  if (validBaseline === 0) {
    console.log('⚠️ No valid baseline images found. Run with --baseline flag to generate baseline screenshots:');
    console.log('   npm run phase1-openai --baseline');
  }
  
  if (validCurrent === 0) {
    console.log('⚠️ No valid current images found. Run a test to generate current screenshots:');
    console.log('   npm run phase1-openai');
  }
  
  if (validDiff === 0) {
    console.log('⚠️ No valid diff images found. This may indicate no differences were detected or the comparison failed.');
    console.log('   Try introducing a visual bug to generate diff images:');
    console.log('   npm run phase1-openai --bug');
  }
  
  console.log('\nIf image conversion tests succeeded but OpenAI analysis still fails:');
  console.log('1. Check your OpenAI API key is valid and has sufficient credits');
  console.log('2. Make sure the files have proper permissions');
  console.log('3. Try running with debug logging: DEBUG=true npm run phase2-openai');
  console.log('4. Verify network connectivity to the OpenAI API');
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error('Diagnostic error:', error);
});
