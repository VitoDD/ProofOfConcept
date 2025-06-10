/**
 * enhanced-visual-bug.js
 * 
 * Runner script to create enhanced visual bugs and update comparison settings
 * for better LLaVA-2 integration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create the enhanced diff image implementation
function enhanceComparisonVisualization() {
  // Path to compare.js
  const compareJsPath = path.join(__dirname, 'src', 'phase1', 'compare.js');
  
  // Read compare.js
  const compareJs = fs.readFileSync(compareJsPath, 'utf8');
  
  // Find and replace the pixelmatch options
  const enhancedCompareJs = compareJs.replace(
    `  // Set default options
  const defaultOptions = {
    threshold: 0.1,      // Threshold for pixel difference (0-1)
    includeAA: false,    // Whether to include anti-aliased pixels in the diff
    alpha: 0.1,          // Opacity of original image in diff output
    aaColor: [255, 255, 0],  // Color of anti-aliased pixels
    diffColor: [255, 0, 0],  // Color of different pixels
    diffMask: false      // Whether to generate a diff mask
  };`,
    `  // Set default options
  const defaultOptions = {
    threshold: 0.1,      // Threshold for pixel difference (0-1)
    includeAA: false,    // Whether to include anti-aliased pixels in the diff
    alpha: 0.3,          // Opacity of original image in diff output (increased for better visibility)
    aaColor: [255, 255, 0],  // Color of anti-aliased pixels
    diffColor: [255, 0, 0],  // Color of different pixels
    diffMask: false,     // Whether to generate a diff mask
    outputDiffMask: true // Enhanced: Create a more visible diff
  };`
  );
  
  // Write enhanced version back
  fs.writeFileSync(compareJsPath, enhancedCompareJs);
  
  console.log('✅ Enhanced comparison visualization settings');
  
  // Update the dimension mismatch visualization to be more informative
  const updatedCompareJs = enhancedCompareJs.replace(
    `      // Create an empty diff image with a red X to indicate dimension mismatch
      const diffWidth = Math.max(baseline.width, current.width);
      const diffHeight = Math.max(baseline.height, current.height);
      
      const diff = new PNG({ width: diffWidth, height: diffHeight });
      
      // Fill with white
      for (let y = 0; y < diffHeight; y++) {
        for (let x = 0; x < diffWidth; x++) {
          const idx = (y * diffWidth + x) << 2;
          diff.data[idx] = 255;     // R
          diff.data[idx + 1] = 255; // G
          diff.data[idx + 2] = 255; // B
          diff.data[idx + 3] = 255; // A
          
          // Draw X pattern in red
          if (x === y || x === (diffWidth - y - 1)) {
            if (x % 5 === 0) { // Make dotted lines
              diff.data[idx] = 255;     // R
              diff.data[idx + 1] = 0;   // G
              diff.data[idx + 2] = 0;   // B
            }
          }
        }
      }`,
    `      // Create a more informative diff image for dimension mismatch
      const diffWidth = Math.max(baseline.width, current.width);
      const diffHeight = Math.max(baseline.height, current.height);
      
      const diff = new PNG({ width: diffWidth, height: diffHeight });
      
      // Draw the baseline image with a blue tint
      for (let y = 0; y < baseline.height; y++) {
        for (let x = 0; x < baseline.width; x++) {
          if (y < diffHeight && x < diffWidth) {
            const idx = (y * diffWidth + x) << 2;
            const baseIdx = (y * baseline.width + x) << 2;
            
            // Get baseline pixel with blue tint
            diff.data[idx] = Math.min(baseline.data[baseIdx] * 0.7, 255);     // R
            diff.data[idx + 1] = Math.min(baseline.data[baseIdx + 1] * 0.7, 255); // G
            diff.data[idx + 2] = Math.min(baseline.data[baseIdx + 2] + 50, 255);  // B with blue boost
            diff.data[idx + 3] = baseline.data[baseIdx + 3];  // A
          }
        }
      }
      
      // Draw the current image with a red tint, offset to show dimension difference
      for (let y = 0; y < current.height; y++) {
        for (let x = 0; x < current.width; x++) {
          // Offset for visual difference
          const offsetX = Math.min(10, Math.floor(diffWidth * 0.02));
          const offsetY = Math.min(10, Math.floor(diffHeight * 0.02));
          
          if ((y + offsetY) < diffHeight && (x + offsetX) < diffWidth) {
            const idx = ((y + offsetY) * diffWidth + (x + offsetX)) << 2;
            const currentIdx = (y * current.width + x) << 2;
            
            // Only draw if not overwriting baseline (semi-transparent blend)
            diff.data[idx] = Math.min(current.data[currentIdx] + 50, 255);     // R with red boost
            diff.data[idx + 1] = Math.min(current.data[currentIdx + 1] * 0.7, 255); // G
            diff.data[idx + 2] = Math.min(current.data[currentIdx + 2] * 0.7, 255); // B
            diff.data[idx + 3] = 200;  // A - semi-transparent
          }
        }
      }
      
      // Add a border around the images to highlight size difference
      const borderWidth = 4;
      
      // Baseline border (blue)
      for (let y = 0; y < baseline.height; y++) {
        for (let x = 0; x < baseline.width; x++) {
          if (y < borderWidth || y >= baseline.height - borderWidth || 
              x < borderWidth || x >= baseline.width - borderWidth) {
            if (y < diffHeight && x < diffWidth) {
              const idx = (y * diffWidth + x) << 2;
              diff.data[idx] = 0;     // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 255; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      // Current border (red) - with offset
      for (let y = 0; y < current.height; y++) {
        for (let x = 0; x < current.width; x++) {
          if (y < borderWidth || y >= current.height - borderWidth || 
              x < borderWidth || x >= current.width - borderWidth) {
            const offsetX = Math.min(10, Math.floor(diffWidth * 0.02));
            const offsetY = Math.min(10, Math.floor(diffHeight * 0.02));
            
            if ((y + offsetY) < diffHeight && (x + offsetX) < diffWidth) {
              const idx = ((y + offsetY) * diffWidth + (x + offsetX)) << 2;
              diff.data[idx] = 255;   // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 0; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      // Add text for dimensions at the bottom
      const baselineDimText = \`Baseline: \${baseline.width}x\${baseline.height}\`;
      const currentDimText = \`Current: \${current.width}x\${current.height}\`;
      
      // This is a simple way to "write" text by changing pixel colors
      // Real text would require more sophisticated rendering
      for (let i = 0; i < baselineDimText.length; i++) {
        const x = 10 + (i * 8);
        const y = diffHeight - 30;
        
        if (x < diffWidth && y < diffHeight) {
          for (let dy = 0; dy < 10; dy++) {
            for (let dx = 0; dx < 6; dx++) {
              const idx = ((y + dy) * diffWidth + (x + dx)) << 2;
              diff.data[idx] = 0;     // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 255; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }
      
      for (let i = 0; i < currentDimText.length; i++) {
        const x = 10 + (i * 8);
        const y = diffHeight - 15;
        
        if (x < diffWidth && y < diffHeight) {
          for (let dy = 0; dy < 10; dy++) {
            for (let dx = 0; dx < 6; dx++) {
              const idx = ((y + dy) * diffWidth + (x + dx)) << 2;
              diff.data[idx] = 255;   // R
              diff.data[idx + 1] = 0; // G
              diff.data[idx + 2] = 0; // B
              diff.data[idx + 3] = 255; // A
            }
          }
        }
      }`
  );
  
  // Write updated version back
  fs.writeFileSync(compareJsPath, updatedCompareJs);
  
  console.log('✅ Enhanced dimension mismatch visualization');
}

// Run the script
try {
  // First, enhance the diff visualization
  enhanceComparisonVisualization();
  
  console.log('\nRunning comprehensive visual bug script...');
  execSync('node comprehensive-visual-bug.js', { stdio: 'inherit' });
  
  console.log('\n✅ Successfully enhanced visual testing for LLaVA-2 integration');
  console.log('To run the test with these enhancements:');
  console.log('  1. Capture baseline: npm run phase1-baseline');
  console.log('  2. Run test: npm run phase1');
  console.log('  3. View results: npm run view-reports');
} catch (error) {
  console.error('Error enhancing visual testing:', error.message);
}
