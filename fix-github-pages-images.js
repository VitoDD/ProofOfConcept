#!/usr/bin/env node

/**
 * fix-github-pages-images.js
 * 
 * Quick fix for GitHub Pages image paths - ensures all images
 * referenced in reports are available in the root directory
 */

const fs = require('fs');
const path = require('path');

function fixGitHubPagesImages() {
  console.log('Fixing GitHub Pages image paths...');
  
  const ghPagesDir = 'gh-pages';
  
  // Ensure gh-pages directory exists
  if (!fs.existsSync(ghPagesDir)) {
    fs.mkdirSync(ghPagesDir, { recursive: true });
  }
  
  // Find all HTML files in gh-pages
  const htmlFiles = fs.readdirSync(ghPagesDir)
    .filter(file => file.endsWith('.html'))
    .map(file => path.join(ghPagesDir, file));
  
  if (htmlFiles.length === 0) {
    console.log('No HTML files found in gh-pages directory');
    return;
  }
  
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
  const imagesToCopy = new Set();
  
  // Process each HTML file
  htmlFiles.forEach(htmlFile => {
    console.log(`Processing: ${htmlFile}`);
    
    try {
      let htmlContent = fs.readFileSync(htmlFile, 'utf8');
      let modified = false;
      
      // Find all image src attributes
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
      let match;
      
      while ((match = imgRegex.exec(htmlContent)) !== null) {
        const imageSrc = match[1];
        const imageFilename = path.basename(imageSrc);
        
        // Skip if it's already a simple filename (correct)
        if (imageSrc === imageFilename) {
          imagesToCopy.add(imageFilename);
          continue;
        }
        
        // Replace complex path with simple filename
        const newHtml = htmlContent.replace(match[0], match[0].replace(imageSrc, imageFilename));
        if (newHtml !== htmlContent) {
          htmlContent = newHtml;
          modified = true;
          imagesToCopy.add(imageFilename);
          console.log(`  Fixed image path: ${imageSrc} -> ${imageFilename}`);
        }
      }
      
      // Write back if modified
      if (modified) {
        fs.writeFileSync(htmlFile, htmlContent);
        console.log(`  Updated: ${htmlFile}`);
      }
    } catch (error) {
      console.warn(`Error processing ${htmlFile}: ${error.message}`);
    }
  });
  
  // Copy all required images to gh-pages root
  console.log(`Copying ${imagesToCopy.size} required images...`);
  
  imagesToCopy.forEach(imageFilename => {
    const destPath = path.join(ghPagesDir, imageFilename);
    
    // Skip if already exists
    if (fs.existsSync(destPath)) {
      return;
    }
    
    // Try to find the image in various locations
    const searchPaths = [
      path.join('reports', imageFilename),
      path.join('screenshots', 'baseline', imageFilename),
      path.join('screenshots', 'current', imageFilename),
      path.join('screenshots', 'diff', imageFilename),
      // Also try with and without prefixes
      path.join('reports', `baseline-${imageFilename}`),
      path.join('reports', `current-${imageFilename}`),
      path.join('reports', `diff-${imageFilename}`),
      // Try searching for files that end with the filename
      ...findFilesByPattern(imageFilename)
    ];
    
    let copied = false;
    for (const sourcePath of searchPaths) {
      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`  Copied: ${imageFilename} from ${sourcePath}`);
          copied = true;
          break;
        } catch (error) {
          // Continue to next path
        }
      }
    }
    
    if (!copied) {
      console.warn(`  Not found: ${imageFilename}`);
    }
  });
  
  console.log('GitHub Pages image fixing complete!');
}

function findFilesByPattern(filename) {
  const results = [];
  const directories = ['reports', 'screenshots'];
  
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        const files = getAllFiles(dir);
        files.forEach(file => {
          if (path.basename(file) === filename || file.endsWith(filename)) {
            results.push(file);
          }
        });
      } catch (error) {
        // Ignore errors
      }
    }
  });
  
  return results;
}

function getAllFiles(dirPath) {
  let results = [];
  
  try {
    const list = fs.readdirSync(dirPath);
    
    list.forEach(file => {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    });
  } catch (error) {
    // Ignore errors
  }
  
  return results;
}

// Run if called directly
if (require.main === module) {
  fixGitHubPagesImages();
}

module.exports = { fixGitHubPagesImages };
