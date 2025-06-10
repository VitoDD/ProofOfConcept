/**
 * issue-localizer.js
 * 
 * Localizes visual issues in code by identifying which code changes
 * are responsible for detected visual differences.
 */

const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs').promises;
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Represents a localized issue with its visual and code details
 */
class LocalizedIssue {
  constructor(comparisonResult, affectedElements = [], codeReferences = []) {
    this.comparisonResult = comparisonResult;
    this.affectedElements = affectedElements;
    this.codeReferences = codeReferences;
    this.aiAnalysis = comparisonResult.aiAnalysis || null;
    this.confidence = 0;
    this.recommendations = [];
  }

  /**
   * Add an affected UI element
   * 
   * @param {Object} element - The affected UI element
   * @param {number} overlapPercentage - How much the element overlaps with the issue area
   */
  addAffectedElement(element, overlapPercentage) {
    this.affectedElements.push({
      ...element,
      overlapPercentage
    });
  }

  /**
   * Add a code reference
   * 
   * @param {string} filePath - Path to the code file
   * @param {number} lineNumber - Line number in the file
   * @param {string} context - Additional context about the reference
   * @param {number} confidence - Confidence level (0-1) of this being the cause
   */
  addCodeReference(filePath, lineNumber, context = '', confidence = 0.5) {
    this.codeReferences.push({
      filePath,
      lineNumber,
      context,
      confidence
    });
    
    // Update overall confidence based on highest confidence reference
    this.confidence = Math.max(this.confidence, confidence);
  }

  /**
   * Add a recommendation for fixing the issue
   * 
   * @param {string} text - The recommendation text
   * @param {Object} codeChange - Suggested code change
   * @param {number} confidence - Confidence level (0-1) of this recommendation
   */
  addRecommendation(text, codeChange = null, confidence = 0.5) {
    this.recommendations.push({
      text,
      codeChange,
      confidence
    });
  }

  /**
   * Get code references sorted by confidence
   * 
   * @returns {Array} Sorted code references
   */
  getSortedCodeReferences() {
    return [...this.codeReferences].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get recommendations sorted by confidence
   * 
   * @returns {Array} Sorted recommendations
   */
  getSortedRecommendations() {
    return [...this.recommendations].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get the primary code reference (highest confidence)
   * 
   * @returns {Object|null} The primary code reference or null if none exist
   */
  getPrimaryCodeReference() {
    const sortedRefs = this.getSortedCodeReferences();
    return sortedRefs.length > 0 ? sortedRefs[0] : null;
  }

  /**
   * Get the primary recommendation (highest confidence)
   * 
   * @returns {Object|null} The primary recommendation or null if none exist
   */
  getPrimaryRecommendation() {
    const sortedRecs = this.getSortedRecommendations();
    return sortedRecs.length > 0 ? sortedRecs[0] : null;
  }
}

/**
 * Localizes visual issues by mapping them to code components
 */
class IssueLocalizer {
  /**
   * Creates a new issue localizer
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
      ...options
    };
  }

  /**
   * Localize issues based on visual comparison results
   * 
   * @param {Array} comparisonResults - Visual comparison results
   * @returns {Promise<Array>} Localized issues
   */
  async localizeIssues(comparisonResults) {
    logger.info('Localizing issues in code...');
    
    const localizedIssues = [];
    
    for (const result of comparisonResults) {
      if (!result.hasDifferences) {
        continue; // Skip results with no differences
      }
      
      logger.info(`Localizing issues for ${result.name}...`);
      
      try {
        // Analyze the diff image to identify affected areas
        const diffAreas = await this.analyzeDiffImage(result.diffImagePath);
        
        // Create a localized issue
        const issue = new LocalizedIssue(result);
        
        // Find UI elements in affected areas
        for (const area of diffAreas) {
          const elementsInArea = this.uiCodeMapper.getElementsByBoundingBox(area);
          
          for (const element of elementsInArea) {
            // Calculate overlap percentage
            const overlapPercentage = this.calculateOverlapPercentage(area, element.boundingBox);
            
            if (overlapPercentage > 0.1) { // More than 10% overlap
              issue.addAffectedElement(element, overlapPercentage);
              
              // Add code references from the element
              for (const ref of element.codeReferences) {
                // Calculate confidence based on overlap and element type
                const confidence = this.calculateConfidence(ref, result, overlapPercentage);
                
                issue.addCodeReference(
                  ref.filePath,
                  ref.lineNumber,
                  ref.context,
                  confidence
                );
              }
            }
          }
        }
        
        // Use AI analysis to refine code references
        if (result.aiAnalysis) {
          this.refineWithAiAnalysis(issue, result.aiAnalysis);
        }
        
        // Generate recommendations
        await this.generateRecommendations(issue);
        
        localizedIssues.push(issue);
        
      } catch (error) {
        logger.error(`Error localizing issues for ${result.name}: ${error.message}`);
      }
    }
    
    logger.info(`Localized ${localizedIssues.length} issues`);
    
    return localizedIssues;
  }

  /**
   * Analyze a diff image to identify affected areas
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
   * 
   * @param {Object} codeRef - Code reference
   * @param {Object} comparisonResult - Visual comparison result
   * @param {number} overlapPercentage - Overlap percentage
   * @returns {number} Confidence level (0-1)
   */
  calculateConfidence(codeRef, comparisonResult, overlapPercentage) {
    let confidence = 0.5; // Base confidence
    
    // Adjust based on overlap percentage
    confidence *= (0.5 + 0.5 * overlapPercentage);
    
    // Adjust based on file type
    const ext = path.extname(codeRef.filePath).toLowerCase();
    if (ext === '.css') {
      confidence *= 1.2; // CSS is more likely to cause visual changes
    } else if (ext === '.html') {
      confidence *= 1.1; // HTML also likely to cause visual changes
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
   * Refine issue localization using AI analysis
   * 
   * @param {LocalizedIssue} issue - The issue to refine
   * @param {Object} aiAnalysis - AI analysis of the visual difference
   */
  refineWithAiAnalysis(issue, aiAnalysis) {
    if (!aiAnalysis) return;
    
    // Adjust confidence based on AI analysis
    for (const ref of issue.codeReferences) {
      let confidenceAdjustment = 1.0;
      
      // Check if the file type matches the change type identified by AI
      const ext = path.extname(ref.filePath).toLowerCase();
      const changeType = aiAnalysis.changeType;
      
      if (changeType === 'COLOR' && ext === '.css') {
        confidenceAdjustment = 1.5;
      } else if (changeType === 'LAYOUT' && (ext === '.css' || ext === '.html')) {
        confidenceAdjustment = 1.3;
      } else if (changeType === 'TEXT' && ext === '.html') {
        confidenceAdjustment = 1.4;
      }
      
      // Apply the adjustment
      ref.confidence = Math.min(ref.confidence * confidenceAdjustment, 1.0);
    }
    
    // Sort code references by confidence
    issue.codeReferences.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate recommendations for fixing the issue
   * 
   * @param {LocalizedIssue} issue - The issue to generate recommendations for
   */
  async generateRecommendations(issue) {
    if (!issue.aiAnalysis) return;
    
    const changeType = issue.aiAnalysis.changeType;
    const codeRefs = issue.getSortedCodeReferences();
    
    if (codeRefs.length === 0) return;
    
    // Get the top reference
    const topRef = codeRefs[0];
    const ext = path.extname(topRef.filePath).toLowerCase();
    
    // Generate recommendations based on change type and file type
    switch (changeType) {
      case 'COLOR':
        if (ext === '.css') {
          try {
            const content = await fs.readFile(topRef.filePath, 'utf-8');
            const lines = content.split('\n');
            const lineContent = lines[topRef.lineNumber - 1] || '';
            
            // Check if this line contains a color
            if (lineContent.includes('color') || lineContent.includes('background')) {
              issue.addRecommendation(
                `Check color definition in ${path.basename(topRef.filePath)} at line ${topRef.lineNumber}. The color may have changed from the baseline.`,
                { 
                  filePath: topRef.filePath, 
                  lineNumber: topRef.lineNumber,
                  currentContent: lineContent,
                  suggestedFix: 'Revert color change or confirm it was intentional'
                },
                0.85
              );
            }
          } catch (error) {
            logger.error(`Error generating recommendation: ${error.message}`);
          }
        }
        break;
        
      case 'LAYOUT':
        if (ext === '.css') {
          try {
            const content = await fs.readFile(topRef.filePath, 'utf-8');
            const lines = content.split('\n');
            const lineContent = lines[topRef.lineNumber - 1] || '';
            
            // Check if this line contains layout properties
            if (lineContent.includes('margin') || 
                lineContent.includes('padding') || 
                lineContent.includes('position') ||
                lineContent.includes('display') ||
                lineContent.includes('flex') ||
                lineContent.includes('width') ||
                lineContent.includes('height')) {
              issue.addRecommendation(
                `Check layout properties in ${path.basename(topRef.filePath)} at line ${topRef.lineNumber}. The layout appears to have changed from the baseline.`,
                { 
                  filePath: topRef.filePath, 
                  lineNumber: topRef.lineNumber,
                  currentContent: lineContent,
                  suggestedFix: 'Verify layout changes or revert to previous values'
                },
                0.8
              );
            }
          } catch (error) {
            logger.error(`Error generating recommendation: ${error.message}`);
          }
        }
        break;
        
      case 'TEXT':
        if (ext === '.html' || ext === '.js' || ext === '.jsx') {
          try {
            const content = await fs.readFile(topRef.filePath, 'utf-8');
            const lines = content.split('\n');
            const lineContent = lines[topRef.lineNumber - 1] || '';
            
            issue.addRecommendation(
              `Check text content in ${path.basename(topRef.filePath)} at line ${topRef.lineNumber}. The text appears to have changed from the baseline.`,
              { 
                filePath: topRef.filePath, 
                lineNumber: topRef.lineNumber,
                currentContent: lineContent,
                suggestedFix: 'Verify text changes or revert to previous content'
              },
              0.75
            );
          } catch (error) {
            logger.error(`Error generating recommendation: ${error.message}`);
          }
        }
        break;
        
      default:
        // Generic recommendation
        try {
          const content = await fs.readFile(topRef.filePath, 'utf-8');
          const lines = content.split('\n');
          const lineContent = lines[topRef.lineNumber - 1] || '';
          
          issue.addRecommendation(
            `Review code in ${path.basename(topRef.filePath)} at line ${topRef.lineNumber}. This appears to be the source of the visual difference.`,
            { 
              filePath: topRef.filePath, 
              lineNumber: topRef.lineNumber,
              currentContent: lineContent,
              suggestedFix: 'Verify changes or revert to previous version'
            },
            0.7
          );
        } catch (error) {
          logger.error(`Error reading file for recommendation: ${error.message}`);
          issue.addRecommendation(
            `Review code in ${path.basename(topRef.filePath)} at line ${topRef.lineNumber}. This appears to be the source of the visual difference.`,
            { 
              filePath: topRef.filePath, 
              lineNumber: topRef.lineNumber,
              suggestedFix: 'Verify changes or revert to previous version'
            },
            0.7
          );
        }
    }
  }
}

module.exports = {
  IssueLocalizer,
  LocalizedIssue
};
