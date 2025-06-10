#!/usr/bin/env node

/**
 * fix-report-images.js
 * 
 * Fixes image paths in HTML reports and ensures all referenced images
 * are copied to the correct location for GitHub Pages deployment.
 */

const fs = require('fs');
const path = require('path');

/**
 * Fixes image paths in an HTML report
 * @param {string} htmlFilePath - Path to the HTML file
 * @param {string} outputDir - Output directory for the fixed report
 */
function fixReportImages(htmlFilePath, outputDir = 'gh-pages') {
  console.log(`Processing report: ${htmlFilePath}`);
  
  if (!fs.existsSync(htmlFilePath)) {
    console.warn(`Report file not found: ${htmlFilePath}`);
    return;
  }
  
  // Read the HTML content
  let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  
  // Track images that need to be copied
  const imagesToCopy = new Set();
  
  // Find all image references in the HTML
  const imageRegex = /<img[^>]+src="([^"]+)"/g;
  let match;
  
  while ((match = imageRegex.exec(htmlContent)) !== null) {
    const imagePath = match[1];
    
    // Skip if it's already a simple filename (what we want)
    if (!imagePath.includes('/') && !imagePath.includes('\\')) {
      imagesToCopy.add(imagePath);
      continue;
    }
    
    // Extract filename from path
    const filename = path.basename(imagePath);
    imagesToCopy.add(filename);
    
    // Replace the path with just the filename
    htmlContent = htmlContent.replace(imagePath, filename);
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Copy the fixed HTML to output directory
  const outputHtmlPath = path.join(outputDir, path.basename(htmlFilePath));
  fs.writeFileSync(outputHtmlPath, htmlContent);
  console.log(`Fixed HTML saved to: ${outputHtmlPath}`);
  
  // Copy referenced images to output directory
  imagesToCopy.forEach(filename => {
    const possiblePaths = [
      path.join('reports', filename),
      path.join('screenshots', 'baseline', filename),
      path.join('screenshots', 'current', filename),
      path.join('screenshots', 'diff', filename),
      path.join('screenshots', filename)
    ];
    
    // Find the image file
    let sourceImagePath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        sourceImagePath = possiblePath;
        break;
      }
    }
    
    if (sourceImagePath) {
      const destImagePath = path.join(outputDir, filename);
      try {
        fs.copyFileSync(sourceImagePath, destImagePath);
        console.log(`Copied image: ${filename}`);
      } catch (error) {
        console.warn(`Failed to copy ${filename}: ${error.message}`);
      }
    } else {
      console.warn(`Image not found: ${filename}`);
    }
  });
  
  return {
    fixedHtmlPath: outputHtmlPath,
    imagesCopied: imagesToCopy.size
  };
}

/**
 * Process all HTML reports in the reports directory
 */
function processAllReports() {
  const reportsDir = 'reports';
  const outputDir = 'gh-pages';
  
  if (!fs.existsSync(reportsDir)) {
    console.warn('Reports directory not found');
    return;
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Find all HTML files in reports directory
  const htmlFiles = fs.readdirSync(reportsDir)
    .filter(file => file.endsWith('.html'))
    .map(file => path.join(reportsDir, file));
  
  if (htmlFiles.length === 0) {
    console.warn('No HTML reports found');
    return;
  }
  
  console.log(`Found ${htmlFiles.length} HTML reports to process`);
  
  let totalImagesProcessed = 0;
  
  htmlFiles.forEach(htmlFile => {
    try {
      const result = fixReportImages(htmlFile, outputDir);
      totalImagesProcessed += result.imagesCopied;
    } catch (error) {
      console.error(`Error processing ${htmlFile}: ${error.message}`);
    }
  });
  
  console.log(`\nProcessing complete:`);
  console.log(`- ${htmlFiles.length} reports processed`);
  console.log(`- ${totalImagesProcessed} images copied`);
  console.log(`- Output directory: ${outputDir}`);
  
  // Also copy any additional image files that might not be referenced in reports
  copyAdditionalImages(outputDir);
}

/**
 * Copy additional image files that might not be referenced in reports
 */
function copyAdditionalImages(outputDir) {
  const imageDirs = [
    'reports',
    'screenshots/baseline',
    'screenshots/current',
    'screenshots/diff'
  ];
  
  let additionalImagesCopied = 0;
  
  imageDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(file => 
        file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
      );
      
      files.forEach(file => {
        const sourcePath = path.join(dir, file);
        const destPath = path.join(outputDir, file);
        
        // Only copy if destination doesn't exist or is older
        if (!fs.existsSync(destPath) || 
            fs.statSync(sourcePath).mtime > fs.statSync(destPath).mtime) {
          try {
            fs.copyFileSync(sourcePath, destPath);
            additionalImagesCopied++;
          } catch (error) {
            // Ignore errors for additional images
          }
        }
      });
    }
  });
  
  if (additionalImagesCopied > 0) {
    console.log(`- ${additionalImagesCopied} additional images copied`);
  }
}

// If script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Process specific file
    const htmlFile = args[0];
    const outputDir = args[1] || 'gh-pages';
    fixReportImages(htmlFile, outputDir);
  } else {
    // Process all reports
    processAllReports();
  }
}

module.exports = {
  fixReportImages,
  processAllReports
};
