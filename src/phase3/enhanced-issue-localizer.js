/**
 * enhanced-issue-localizer.js
 * 
 * Improved version of the issue localizer with better deduplication,
 * prioritization, and AI integration.
 */

const path = require('path');
const fs = require('fs').promises;
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');
const { LocalizedIssue } = require('./issue-localizer');

/**
 * Enhanced issue localizer with improved deduplication, prioritization,
 * and better AI integration.
 */
class EnhancedIssueLocalizer {
  /**
   * Creates a new enhanced issue localizer
   * 
   * @param {Object} uiCodeMapper - The UI-Code mapper
   * @param {Object} codebaseMap - The codebase map
   * @param {Object} options - Localizer options
   */
  constructor(uiCodeMapper, codebaseMap, options = {}) {
    this.uiCodeMapper = uiCodeMapper;
    this.codebaseMap = codebaseMap;
    this.options = {
      screenshotsDir: getConfig('screenshots.directory', './screenshots'),
      diffThreshold: getConfig('comparison.threshold', 0.1),
      similarityThreshold: 0.7, // Threshold for determining similar issues
      maxIssuesPerType: 3, // Maximum issues to keep per type
      ...options
    };
  }

  /**
   * Localize issues based on visual comparison results with improved deduplication
   * 
   * @param {Array} comparisonResults - Visual comparison results
   * @returns {Promise<Array>} Localized issues
   */
  async localizeIssues(comparisonResults) {
    logger.info('Localizing issues with enhanced process...');
    
    const allIssues = [];
    
    for (const result of comparisonResults) {
      if (!result.hasDifferences) {
        continue; // Skip results with no differences
      }
      
      if (result.aiAnalysis?.isFalsePositive) {
        logger.info(`Skipping false positive for ${result.name}`);
        continue; // Skip false positives
      }
      
      logger.info(`Localizing issues for ${result.name}...`);
      
      try {
        // Analyze the diff image to identify affected areas
        const diffAreas = await this.analyzeDiffImage(result.diffImagePath);
        
        // Classify each area based on AI analysis if available
        const classifiedAreas = this.classifyDiffAreas(diffAreas, result.aiAnalysis);
        
        // Create localized issues for each classified area
        for (const area of classifiedAreas) {
          const issue = new LocalizedIssue(result);
          
          // Find UI elements in this area
          const elementsInArea = this.uiCodeMapper.getElementsByBoundingBox(area.boundingBox);
          
          for (const element of elementsInArea) {
            // Calculate overlap percentage
            const overlapPercentage = this.calculateOverlapPercentage(area.boundingBox, element.boundingBox);
            
            if (overlapPercentage > 0.1) { // More than 10% overlap
              issue.addAffectedElement(element, overlapPercentage);
              
              // Add code references from the element
              for (const ref of element.codeReferences) {
                // Calculate confidence based on overlap, element type, and issue type
                const confidence = this.calculateConfidence(ref, result, area.type, overlapPercentage);
                
                issue.addCodeReference(
                  ref.filePath,
                  ref.lineNumber,
                  ref.context,
                  confidence
                );
              }
            }
          }
          
          // Set issue type from area classification
          issue.type = area.type;
          issue.description = area.description || result.aiAnalysis?.description || '';
          
          // Add to all issues
          allIssues.push(issue);
        }
      } catch (error) {
        logger.error(`Error localizing issues for ${result.name}: ${error.message}`);
      }
    }
    
    // Deduplicate and prioritize issues
    const dedupedIssues = this.deduplicateAndPrioritize(allIssues);
    
    logger.info(`Localized ${dedupedIssues.length} unique issues (from ${allIssues.length} total)`);
    
    return dedupedIssues;
  }

  /**
   * Analyze a diff image to identify affected areas
   * (Same as original but with enhanced error handling)
   * 
   * @param {string} diffImagePath - Path to the diff image
   * @returns {Promise<Array>} Array of affected areas (bounding boxes)
   */
  async analyzeDiffImage(diffImagePath) {
    try {
      // Get basename and handle cases without diff- prefix
      const basename = path.basename(diffImagePath || '');
      let basenames = [basename];
      
      // Add variations with and without diff- prefix
      if (basename.startsWith('diff-')) {
        basenames.push(basename.substring(5)); // Without 'diff-' prefix
      } else {
        basenames.push(`diff-${basename}`); // With 'diff-' prefix
      }
      
      // Generate all possible paths to check
      let possiblePaths = [];
      
      // Add the original path first
      possiblePaths.push(diffImagePath);
      
      // Add all variations of paths for each basename
      for (const name of basenames) {
        possiblePaths.push(
          path.join(process.cwd(), 'reports', name),
          path.join(process.cwd(), 'screenshots', 'diff', name),
          path.join(process.cwd(), 'screenshots', name)
        );
      }
      
      // Remove duplicates
      possiblePaths = [...new Set(possiblePaths)];
      
      let actualPath = null;
      
      // Try each possible path
      for (const tryPath of possiblePaths) {
        try {
          await fs.access(tryPath);
          actualPath = tryPath;
          logger.info(`Found diff image at: ${tryPath}`);
          break;
        } catch (error) {
          // Continue to the next path
        }
      }
      
      // If no path found, attempt to create a placeholder diff image
      if (!actualPath) {
        logger.warn(`Diff image not found at any expected location: ${diffImagePath}`);
        logger.info('Attempting to create a placeholder diff image...');
        
        try {
          // Create a simple red placeholder image
          const { PNG } = require('pngjs');
          
          // Default dimensions if we can't determine them
          const width = 800;
          const height = 600;
          
          // Create a new PNG image
          const image = new PNG({ width, height });
          
          // Fill with red pixels
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) << 2;
              image.data[idx] = 255;      // R
              image.data[idx + 1] = 0;    // G
              image.data[idx + 2] = 0;    // B
              image.data[idx + 3] = 255;  // A
            }
          }
          
          // Use a reliable path in reports directory
          const placeholderPath = path.join(process.cwd(), 'reports', `diff-${basename}`);
          
          // Write the placeholder image
          const buffer = PNG.sync.write(image);
          await fs.writeFile(placeholderPath, buffer);
          
          logger.info(`Created placeholder diff image at: ${placeholderPath}`);
          actualPath = placeholderPath;
        } catch (placeholderError) {
          logger.error(`Failed to create placeholder image: ${placeholderError.message}`);
          return [];
        }
      }
      
      // Use the actual found path
      diffImagePath = actualPath;
      
      // Read the diff image
      let diffData;
      try {
        diffData = await fs.readFile(diffImagePath);
        logger.info(`Successfully read diff image: ${diffImagePath}`);
      } catch (error) {
        logger.error(`Failed to read diff image: ${error.message}`);
        return [];
      }
      
      let diffImage;
      try {
        diffImage = PNG.sync.read(diffData);
      } catch (error) {
        logger.error(`Failed to parse diff image: ${error.message}`);
        return [];
      }
      
      // Scan the diff image for contiguous areas of difference
      const areas = [];
      const visited = new Array(diffImage.width * diffImage.height).fill(false);
      
      // Count total pixels with differences
      let totalDiffPixels = 0;
      
      for (let y = 0; y < diffImage.height; y++) {
        for (let x = 0; x < diffImage.width; x++) {
          const idx = (y * diffImage.width + x) * 4;
          
          // Check if this pixel has a difference (red channel > 0)
          if (diffImage.data[idx] > 0) {
            totalDiffPixels++;
            
            if (!visited[y * diffImage.width + x]) {
              // Found a difference pixel, perform flood fill to find the entire area
              const area = this.floodFill(diffImage, x, y, visited);
              if (area.width > 0 && area.height > 0) {
                areas.push(area);
              }
            }
          }
        }
      }
      
      logger.info(`Analyzed diff image: found ${areas.length} distinct areas with ${totalDiffPixels} total diff pixels`);
      
      // If no distinct areas were found but there are diff pixels, 
      // create at least one area to ensure we can localize something
      if (areas.length === 0 && totalDiffPixels > 0) {
        // Find the bounds of all diff pixels
        let minX = diffImage.width, maxX = 0, minY = diffImage.height, maxY = 0;
        
        for (let y = 0; y < diffImage.height; y++) {
          for (let x = 0; x < diffImage.width; x++) {
            const idx = (y * diffImage.width + x) * 4;
            
            if (diffImage.data[idx] > 0) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
        }
        
        // Create a single area encompassing all diff pixels
        areas.push({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        });
        
        logger.info(`Created a fallback area encompassing all diff pixels: ${JSON.stringify(areas[0])}`);
      }
      
      // Sort areas by size (largest first)
      return areas.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } catch (error) {
      logger.error(`Unexpected error analyzing diff image: ${error.message}`);
      return [];
    }
  }

  /**
   * Perform flood fill algorithm to find a contiguous area of differences
   * (Same as original)
   * 
   * @param {Object} image - The diff image
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate
   * @param {Array} visited - Array to track visited pixels
   * @returns {Object} Bounding box of the contiguous area
   */
  floodFill(image, startX, startY, visited) {
    const queue = [{ x: startX, y: startY }];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const idx = (y * image.width + x);
      
      if (x < 0 || x >= image.width || y < 0 || y >= image.height || visited[idx]) {
        continue;
      }
      
      // Check if this pixel has a difference (red channel > 0)
      const pixelIdx = idx * 4;
      if (image.data[pixelIdx] === 0) {
        continue;
      }
      
      // Mark as visited
      visited[idx] = true;
      
      // Update bounding box
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Add adjacent pixels to the queue
      queue.push({ x: x + 1, y });
      queue.push({ x: x - 1, y });
      queue.push({ x, y: y + 1 });
      queue.push({ x, y: y - 1 });
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  /**
   * Calculate the overlap percentage between two bounding boxes
   * (Same as original)
   * 
   * @param {Object} box1 - First bounding box
   * @param {Object} box2 - Second bounding box
   * @returns {number} Overlap percentage (0-1)
   */
  calculateOverlapPercentage(box1, box2) {
    // Calculate intersection
    const xOverlap = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x));
    const yOverlap = Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y));
    const overlapArea = xOverlap * yOverlap;
    
    // Calculate areas
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    
    // Return the overlap percentage relative to the smaller box
    return overlapArea / Math.min(box1Area, box2Area);
  }

  /**
   * Calculate confidence that a code reference is responsible for the issue
   * (Enhanced to consider issue type)
   * 
   * @param {Object} codeRef - Code reference
   * @param {Object} comparisonResult - Visual comparison result
   * @param {string} issueType - Type of issue (COLOR, TEXT, LAYOUT, etc.)
   * @param {number} overlapPercentage - Overlap percentage
   * @returns {number} Confidence level (0-1)
   */
  calculateConfidence(codeRef, comparisonResult, issueType, overlapPercentage) {
    let confidence = 0.5; // Base confidence
    
    // Adjust based on overlap percentage
    confidence *= (0.5 + 0.5 * overlapPercentage);
    
    // Adjust based on file type and issue type combination
    const ext = path.extname(codeRef.filePath).toLowerCase();
    
    if (issueType === 'COLOR' && ext === '.css') {
      confidence *= 1.5; // CSS is highly likely for color issues
    } else if (issueType === 'LAYOUT' && ext === '.css') {
      confidence *= 1.4; // CSS is likely for layout issues
    } else if (issueType === 'TEXT' && (ext === '.html' || ext === '.js' || ext === '.jsx')) {
      confidence *= 1.4; // HTML/JS is likely for text issues
    } else if (issueType === 'MISSING_ELEMENT' && (ext === '.html' || ext === '.js' || ext === '.jsx')) {
      confidence *= 1.3; // HTML/JS is likely for missing elements
    } else if (ext === '.css') {
      confidence *= 1.2; // CSS is generally more likely for visual changes
    } else if (ext === '.html') {
      confidence *= 1.1; // HTML also likely for visual changes
    }
    
    // Adjust based on file modification status
    const component = this.codebaseMap.components[codeRef.filePath];
    if (component && component.modified) {
      confidence *= 1.5; // Modified files are more likely to be the cause
    }
    
    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Classify diff areas based on AI analysis
   * (New method)
   * 
   * @param {Array} diffAreas - Array of diff areas
   * @param {Object} aiAnalysis - AI analysis of the visual difference
   * @returns {Array} Classified diff areas
   */
  classifyDiffAreas(diffAreas, aiAnalysis) {
    const classifiedAreas = [];
    
    // If no AI analysis or AI identified as false positive, return simple areas
    if (!aiAnalysis || aiAnalysis.isFalsePositive) {
      return diffAreas.map(area => ({
        boundingBox: area,
        type: 'UNKNOWN',
        description: 'Visual difference detected'
      }));
    }
    
    // Get change type from AI analysis
    const changeType = aiAnalysis.changeType || 'UNKNOWN';
    
    // Analyze diff areas and classify them based on characteristics and AI analysis
    for (const area of diffAreas) {
      let areaType = changeType;
      let description = '';
      
      // Try to refine classification based on area characteristics
      if (changeType === 'MIXED') {
        // Try to determine the specific type for this area
        if (area.width > area.height * 3) {
          // Wide and short areas are often text
          areaType = 'TEXT';
          description = 'Text content may be truncated or changed';
        } else if (area.width < 10 || area.height < 10) {
          // Very small areas might be color changes
          areaType = 'COLOR';
          description = 'Color change detected in a small area';
        } else {
          // Larger areas might be layout or missing elements
          areaType = 'LAYOUT';
          description = 'Layout change or missing element detected';
        }
      } else if (changeType === 'COLOR') {
        description = 'Color change detected';
      } else if (changeType === 'LAYOUT') {
        description = 'Layout shift detected';
      } else if (changeType === 'TEXT') {
        description = 'Text content changed';
      } else {
        description = `${changeType} change detected`;
      }
      
      // Add refined description from AI analysis if available
      if (aiAnalysis.description) {
        description += `: ${aiAnalysis.description.substring(0, 100)}${aiAnalysis.description.length > 100 ? '...' : ''}`;
      }
      
      classifiedAreas.push({
        boundingBox: area,
        type: areaType,
        description
      });
    }
    
    return classifiedAreas;
  }

  /**
   * Deduplicate and prioritize issues
   * (New method)
   * 
   * @param {Array} issues - Array of localized issues
   * @returns {Array} Deduplicated and prioritized issues
   */
  deduplicateAndPrioritize(issues) {
    // Group issues by type
    const issuesByType = {};
    
    for (const issue of issues) {
      const type = issue.type || 'UNKNOWN';
      
      if (!issuesByType[type]) {
        issuesByType[type] = [];
      }
      
      issuesByType[type].push(issue);
    }
    
    // Deduplicate within each type
    const deduplicatedIssues = [];
    
    for (const [type, typeIssues] of Object.entries(issuesByType)) {
      // Sort by highest confidence and severity first
      const sortedIssues = typeIssues.sort((a, b) => {
        // First by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        
        // Then by severity (HIGH > MEDIUM > LOW)
        const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
        const aSeverity = severityOrder[a.aiAnalysis?.severity || 'UNKNOWN'] || 0;
        const bSeverity = severityOrder[b.aiAnalysis?.severity || 'UNKNOWN'] || 0;
        
        return bSeverity - aSeverity;
      });
      
      // Keep track of already included issues to avoid duplicates
      const includedIssues = [];
      
      for (const issue of sortedIssues) {
        // Check if this issue is similar to any already included issues
        const isSimilar = includedIssues.some(includedIssue => 
          this.areIssuesSimilar(issue, includedIssue)
        );
        
        if (!isSimilar) {
          // Only add if not similar to existing issues
          includedIssues.push(issue);
          
          // Stop after reaching the maximum issues per type
          if (includedIssues.length >= this.options.maxIssuesPerType) {
            break;
          }
        }
      }
      
      // Add deduplicated issues for this type
      deduplicatedIssues.push(...includedIssues);
    }
    
    return deduplicatedIssues;
  }

  /**
   * Check if two issues are similar
   * (New method)
   * 
   * @param {Object} issue1 - First issue
   * @param {Object} issue2 - Second issue
   * @returns {boolean} Whether the issues are similar
   */
  areIssuesSimilar(issue1, issue2) {
    // If they have different types, they're not similar
    if (issue1.type !== issue2.type) {
      return false;
    }
    
    // Check if they have similar affected elements
    const elements1 = issue1.affectedElements.map(el => el.selector).sort();
    const elements2 = issue2.affectedElements.map(el => el.selector).sort();
    
    // If both have affected elements, check for overlap
    if (elements1.length > 0 && elements2.length > 0) {
      const commonElements = elements1.filter(selector => elements2.includes(selector));
      const similarity = commonElements.length / Math.max(elements1.length, elements2.length);
      
      if (similarity >= this.options.similarityThreshold) {
        return true;
      }
    }
    
    // Check if they have similar code references
    const refs1 = issue1.codeReferences.map(ref => `${ref.filePath}:${ref.lineNumber}`).sort();
    const refs2 = issue2.codeReferences.map(ref => `${ref.filePath}:${ref.lineNumber}`).sort();
    
    // If both have code references, check for overlap
    if (refs1.length > 0 && refs2.length > 0) {
      const commonRefs = refs1.filter(ref => refs2.includes(ref));
      const similarity = commonRefs.length / Math.max(refs1.length, refs2.length);
      
      if (similarity >= this.options.similarityThreshold) {
        return true;
      }
    }
    
    // Not similar
    return false;
  }
}

module.exports = {
  EnhancedIssueLocalizer
};
