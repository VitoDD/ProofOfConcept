#!/usr/bin/env node

/**
 * test-image-fixes.js
 * 
 * Test script to validate the image fixing functionality
 */

const fs = require('fs');
const path = require('path');
const { fixReportImages } = require('./fix-report-images');
const { fixGitHubPagesImages } = require('./fix-github-pages-images');

function createTestReport() {
  console.log('Creating test report with image references...');
  
  const testHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Test Report</title>
</head>
<body>
  <h1>Test Visual Report</h1>
  
  <div class="comparison">
    <h2>Full Page Comparison</h2>
    <img src="reports/baseline-full.png" alt="Baseline">
    <img src="/screenshots/current/current-full.png" alt="Current">
    <img src="../diff/diff-full.png" alt="Diff">
  </div>
  
  <div class="comparison">
    <h2>Header Comparison</h2>
    <img src="baseline-header.png" alt="Baseline Header">
    <img src="current-header.png" alt="Current Header">
    <img src="diff-header.png" alt="Diff Header">
  </div>
</body>
</html>`;

  // Ensure reports directory exists
  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports', { recursive: true });
  }
  
  const testReportPath = path.join('reports', 'test-report.html');
  fs.writeFileSync(testReportPath, testHtml);
  
  console.log(`Test report created at: ${testReportPath}`);
  return testReportPath;
}

function createTestImages() {
  console.log('Creating test images...');
  
  const imageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
  
  // Create test images in various locations
  const imagePaths = [
    'reports/baseline-full.png',
    'reports/current-full.png',
    'reports/diff-full.png',
    'reports/baseline-header.png',
    'reports/current-header.png',
    'reports/diff-header.png'
  ];
  
  imagePaths.forEach(imagePath => {
    const dir = path.dirname(imagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(imagePath, imageData);
    console.log(`Created test image: ${imagePath}`);
  });
}

function testImageFixing() {
  console.log('=== Testing Image Fixing Scripts ===\n');
  
  try {
    // Create test environment
    createTestImages();
    const testReportPath = createTestReport();
    
    // Test fix-report-images.js
    console.log('\n--- Testing fix-report-images.js ---');
    const result = fixReportImages(testReportPath, 'test-gh-pages');
    console.log(`Fixed HTML: ${result.fixedHtmlPath}`);
    console.log(`Images copied: ${result.imagesCopied}`);
    
    // Verify the fixed HTML
    if (fs.existsSync(result.fixedHtmlPath)) {
      const fixedHtml = fs.readFileSync(result.fixedHtmlPath, 'utf8');
      console.log('\nFixed HTML contains relative paths:');
      
      const imageRefs = fixedHtml.match(/<img[^>]+src="([^"]+)"/g);
      if (imageRefs) {
        imageRefs.forEach(ref => {
          console.log(`  ${ref}`);
        });
      }
    }
    
    // Test fix-github-pages-images.js
    console.log('\n--- Testing fix-github-pages-images.js ---');
    // First ensure we have a gh-pages directory with test content
    if (!fs.existsSync('gh-pages')) {
      fs.mkdirSync('gh-pages', { recursive: true });
    }
    
    // Copy our test report to gh-pages
    if (fs.existsSync('test-gh-pages/test-report.html')) {
      fs.copyFileSync('test-gh-pages/test-report.html', 'gh-pages/test-report.html');
    }
    
    fixGitHubPagesImages();
    
    // Verify results
    console.log('\n--- Verification ---');
    
    if (fs.existsSync('gh-pages')) {
      const files = fs.readdirSync('gh-pages');
      console.log('Files in gh-pages directory:');
      files.forEach(file => {
        const stats = fs.statSync(path.join('gh-pages', file));
        console.log(`  ${file} (${stats.size} bytes)`);
      });
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
  } finally {
    // Cleanup test files
    console.log('\n--- Cleanup ---');
    try {
      if (fs.existsSync('test-gh-pages')) {
        fs.rmSync('test-gh-pages', { recursive: true, force: true });
        console.log('Cleaned up test-gh-pages directory');
      }
      if (fs.existsSync('reports/test-report.html')) {
        fs.unlinkSync('reports/test-report.html');
        console.log('Cleaned up test report');
      }
    } catch (cleanupError) {
      console.warn(`Cleanup warning: ${cleanupError.message}`);
    }
  }
}

function validateCurrentSetup() {
  console.log('=== Validating Current Setup ===\n');
  
  // Check if required scripts exist
  const scripts = [
    'fix-report-images.js',
    'fix-github-pages-images.js'
  ];
  
  scripts.forEach(script => {
    if (fs.existsSync(script)) {
      console.log(`✅ ${script} exists`);
    } else {
      console.log(`❌ ${script} missing`);
    }
  });
  
  // Check package.json scripts
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = [
      'fix-report-images',
      'fix-github-pages-images'
    ];
    
    console.log('\nPackage.json scripts:');
    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        console.log(`✅ ${script}: ${packageJson.scripts[script]}`);
      } else {
        console.log(`❌ ${script} missing from package.json`);
      }
    });
  }
  
  // Check GitHub workflow
  const workflowPath = '.github/workflows/openai-visual-testing-workflow.yml';
  if (fs.existsSync(workflowPath)) {
    console.log(`\n✅ GitHub workflow exists: ${workflowPath}`);
    
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    if (workflowContent.includes('fix-github-pages-images')) {
      console.log('✅ Workflow includes image fixing scripts');
    } else {
      console.log('❌ Workflow missing image fixing scripts');
    }
  } else {
    console.log(`\n❌ GitHub workflow missing: ${workflowPath}`);
  }
}

// Run tests
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--validate') || args.includes('-v')) {
    validateCurrentSetup();
  } else {
    testImageFixing();
  }
  
  if (args.includes('--all') || args.includes('-a')) {
    console.log('\n' + '='.repeat(50) + '\n');
    validateCurrentSetup();
  }
}

module.exports = {
  createTestReport,
  createTestImages,
  testImageFixing,
  validateCurrentSetup
};
