/**
 * openai-visual-analyzer.js
 * 
 * AI-powered analysis of visual differences using OpenAI models.
 */

const path = require('path');
const fs = require('fs').promises;
const { analyzeImage, analyzeMultipleImages, generateText } = require('./openai-client');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Confidence threshold for AI analysis
const AI_THRESHOLD = getConfig('ai.threshold', 0.7);

/**
 * Analyzes visual differences between baseline and current screenshots
 * 
 * @param {Object} comparisonResult - Result from image comparison
 * @returns {Promise<Object>} - AI analysis of visual differences
 */
async function analyzeVisualDifference(comparisonResult) {
  logger.info('Analyzing visual difference using OpenAI');
  
  // Skip analysis if no differences
  if (!comparisonResult.hasDifferences || comparisonResult.diffPercentage === 0) {
    logger.info('No visual differences to analyze');
    return {
      hasDifferences: false,
      analysis: 'No visual differences detected',
      changeType: 'NONE',
      severity: 'LOW',
      isFalsePositive: true,
      summary: 'No visual differences detected',
      description: 'No visual differences detected',
      confidence: 1.0
    };
  }
  
  try {
    // Check if all required images exist and get their paths
    let baselineImagePath = comparisonResult.baselineImagePath;
    let currentImagePath = comparisonResult.currentImagePath;
    let allImagesExist = true;
    
    // Ensure images exist and are readable
    try {
      const fs = require('fs');
      allImagesExist = fs.existsSync(baselineImagePath) && 
                       fs.existsSync(currentImagePath);
      
      // If any image is missing, try alternative paths
      if (!allImagesExist) {
        logger.info('Some images are missing, trying alternative paths');
        
        // Try to find alternative paths for missing images
        if (!fs.existsSync(baselineImagePath)) {
          const alternatives = findAlternativePaths(baselineImagePath, 'baseline');
          if (alternatives.length > 0) {
            baselineImagePath = alternatives[0];
            logger.info(`Using alternative baseline path: ${baselineImagePath}`);
          }
        }
        
        if (!fs.existsSync(currentImagePath)) {
          const alternatives = findAlternativePaths(currentImagePath, 'current');
          if (alternatives.length > 0) {
            currentImagePath = alternatives[0];
            logger.info(`Using alternative current path: ${currentImagePath}`);
          }
        }
        
        // Check again with alternative paths
        allImagesExist = fs.existsSync(baselineImagePath) && 
                         fs.existsSync(currentImagePath);
      }
    } catch (fileError) {
      logger.error(`Error checking for images: ${fileError.message}`);
      allImagesExist = false;
    }
    
    if (!allImagesExist) {
      logger.error('Could not find all required images for analysis');
      return {
        hasDifferences: comparisonResult.hasDifferences,
        diffPercentage: comparisonResult.diffPercentage,
        error: 'Missing required images',
        analysis: `Traditional pixel-based comparison detected ${comparisonResult.diffPercentage.toFixed(2)}% differences. Cannot perform AI analysis due to missing images.`,
        changeType: 'UNKNOWN',
        severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                 comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
        confidence: 0.5,
        isFalsePositive: false,
        falsePositive: false,
        summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%)`,
        description: `AI analysis failed due to missing baseline or current images.`,
        rawAnalysis: 'Missing required images for analysis',
        affectedElements: ['UI Element']
      };
    }
    
    // Check file sizes to prevent timeouts with large images
    const fs = require('fs');
    const baselineStats = fs.statSync(baselineImagePath);
    const currentStats = fs.statSync(currentImagePath);
    const totalSize = baselineStats.size + currentStats.size;
    
    // Skip AI analysis for very large images in CI to prevent timeouts
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const maxSizeForCI = 5 * 1024 * 1024; // 5MB total
    
    if (isCI && totalSize > maxSizeForCI) {
      logger.warn(`Skipping AI analysis in CI due to large image size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      return {
        hasDifferences: comparisonResult.hasDifferences,
        diffPercentage: comparisonResult.diffPercentage,
        analysis: `Traditional pixel-based comparison detected ${comparisonResult.diffPercentage.toFixed(2)}% differences. Skipped AI analysis due to large image size in CI environment.`,
        changeType: 'UNKNOWN',
        severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                 comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
        confidence: 0.6,
        isFalsePositive: comparisonResult.diffPercentage < 1.0,
        falsePositive: comparisonResult.diffPercentage < 1.0,
        summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%) - Skipped AI analysis`,
        description: `Pixel comparison found ${comparisonResult.diffPixels || comparisonResult.diffPixelCount || 0} changed pixels. AI analysis was skipped to prevent CI timeouts.`,
        rawAnalysis: 'Skipped due to large image size in CI',
        affectedElements: ['UI Element'],
        skippedReason: 'Large image size in CI environment'
      };
    }
    
    // Update the paths in the comparison result
    const resultWithCorrectPaths = {
      ...comparisonResult,
      baselineImagePath,
      currentImagePath
    };
    
    // Create an enhanced prompt for the visual model that understands multiple images
    const prompt = createMultiImagePrompt(resultWithCorrectPaths);
    
    // Add timeout wrapper to prevent hanging in GitHub Actions
    logger.info('Analyzing baseline and current images only (skipping diff)');
    
    const analysisPromise = analyzeMultipleImages(
      [baselineImagePath, currentImagePath],
      prompt,
      'vision',
      { 
        max_tokens: 1000, // Reduced from 1500 to speed up
        temperature: 0.1  // Lower temperature for more focused responses
      }
    );
    
    // Add timeout to prevent hanging (2 minutes max)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI analysis timed out after 2 minutes')), 120000)
    );
    
    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    
    // Check if analysis contains error message
    if (analysis.includes('Error')) {
      logger.warn(`AI analysis encountered an issue: ${analysis.substring(0, 100)}...`);
      
      // Return a basic error result
      return {
        hasDifferences: comparisonResult.hasDifferences,
        diffPercentage: comparisonResult.diffPercentage,
        error: analysis,
        analysis: `Traditional pixel-based comparison detected ${comparisonResult.diffPercentage.toFixed(2)}% differences. Using fallback classification due to AI error.`,
        changeType: 'UNKNOWN',
        severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                 comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
        confidence: 0.5,
        isFalsePositive: false,
        falsePositive: false,
        summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%)`,
        description: `AI analysis failed, but pixel comparison found ${comparisonResult.diffPixels || comparisonResult.diffPixelCount || 0} changed pixels.`,
        rawAnalysis: analysis,
        affectedElements: ['UI Element']
      };
    }
    
    // Determine severity based on diff percentage
    let severity = 'LOW';
    if (comparisonResult.diffPercentage > 5) {
      severity = 'HIGH';
    } else if (comparisonResult.diffPercentage > 1) {
      severity = 'MEDIUM';
    }

    // Create a comprehensive analysis object
    return {
      hasDifferences: true,
      diffPercentage: comparisonResult.diffPercentage,
      analysis: analysis,
      changeType: 'VISUAL', // Will be refined by enhanceAnalysis
      severity: severity,
      confidence: 0.9, // Higher confidence with multi-image analysis
      isFalsePositive: false,
      falsePositive: false,
      summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%)`,
      description: analysis,
      rawAnalysis: analysis,
      affectedElements: ['UI Element'], // Will be refined by enhanceAnalysis
      usedMultiImageAnalysis: true
    };
    
  } catch (error) {
    logger.error(`Error analyzing visual difference: ${error.message}`);
    
    // Check if it's a timeout error specifically
    if (error.message.includes('timed out')) {
      logger.warn('AI analysis timed out, providing fallback analysis');
      return {
        hasDifferences: comparisonResult.hasDifferences,
        diffPercentage: comparisonResult.diffPercentage,
        error: 'AI analysis timed out',
        analysis: `Traditional pixel-based comparison detected ${comparisonResult.diffPercentage.toFixed(2)}% differences. AI analysis timed out after 2 minutes.`,
        changeType: 'UNKNOWN',
        severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                 comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
        confidence: 0.3, // Lower confidence due to timeout
        isFalsePositive: comparisonResult.diffPercentage < 1.0, // Small changes likely false positives
        falsePositive: comparisonResult.diffPercentage < 1.0,
        summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%) - AI analysis timed out`,
        description: `Pixel comparison found ${comparisonResult.diffPixels || comparisonResult.diffPixelCount || 0} changed pixels. AI analysis could not complete within time limit.`,
        rawAnalysis: 'AI analysis timed out',
        affectedElements: ['UI Element']
      };
    }
    
    // Return a basic error result
    return {
      hasDifferences: comparisonResult.hasDifferences,
      diffPercentage: comparisonResult.diffPercentage,
      error: error.message,
      analysis: `Traditional pixel-based comparison detected ${comparisonResult.diffPercentage.toFixed(2)}% differences. Using fallback classification due to AI error.`,
      changeType: 'UNKNOWN',
      severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
               comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
      confidence: 0.5,
      isFalsePositive: false,
      falsePositive: false,
      summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%)`,
      description: `AI analysis failed, but pixel comparison found ${comparisonResult.diffPixels || comparisonResult.diffPixelCount || 0} changed pixels.`,
      rawAnalysis: error.message,
      affectedElements: ['UI Element']
    };
  }
}

/**
 * Falls back to diff-only analysis when multi-image analysis fails
 * 
 * @param {Object} comparisonResult - Comparison result
 * @param {string} diffImagePath - Path to diff image
 * @returns {Promise<Object>} - Analysis result
 */
async function fallbackToDiffOnlyAnalysis(comparisonResult, diffImagePath) {
  logger.info('Performing fallback diff-only analysis');
  
  // Check if the diff image exists
  let diffImageExists = false;
  try {
    await fs.access(diffImagePath);
    diffImageExists = true;
  } catch (error) {
    // Try to find the diff image in alternative locations
    const alternatives = findAlternativePaths(diffImagePath, 'diff');
    if (alternatives.length > 0) {
      diffImagePath = alternatives[0];
      logger.info(`Found diff image at alternative path: ${diffImagePath}`);
      diffImageExists = true;
    }
  }
  
  if (!diffImageExists) {
    throw new Error(`Diff image not found for ${comparisonResult.name}`);
  }
  
  // Create prompt for the visual model
  const prompt = createVisualPrompt(comparisonResult);
  
  // Analyze diff image only
  const analysis = await analyzeImage(
    diffImagePath,
    prompt,
    'vision'
  );
  
  // Check if analysis contains error message
  if (analysis.includes('Error analyzing image')) {
    logger.warn(`AI analysis encountered an issue: ${analysis.substring(0, 100)}...`);
    
    // Return a simpler analysis with the error
    return {
      hasDifferences: true,
      diffPercentage: comparisonResult.diffPercentage,
      error: analysis,
      analysis: `Traditional pixel-based comparison detected ${comparisonResult.diffPercentage.toFixed(2)}% differences, but AI analysis failed. Using fallback classification.`,
      changeType: 'UNKNOWN',
      severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
               comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
      confidence: 0.5,
      falsePositive: false,
      isFalsePositive: false,
      summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%)`,
      description: analysis,
      rawAnalysis: analysis
    };
  }
  
  // Create a simplified analysis object
  return {
    hasDifferences: true,
    diffPercentage: comparisonResult.diffPercentage,
    analysis: analysis,
    changeType: 'VISUAL',
    severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
             comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
    confidence: 0.8,
    isFalsePositive: false,
    falsePositive: false,
    summary: `Visual differences detected (${comparisonResult.diffPercentage.toFixed(2)}%)`,
    description: analysis,
    rawAnalysis: analysis,
    affectedElements: ['UI Element'],
    usedFallbackAnalysis: true
  };
}

/**
 * Finds alternative paths for an image file
 * 
 * @param {string} originalPath - Original image path
 * @param {string} type - Image type (baseline, current, diff)
 * @returns {Array<string>} - Array of alternative paths
 */
function findAlternativePaths(originalPath, type) {
  const alternatives = [];
  const baseDir = path.dirname(originalPath);
  const filename = path.basename(originalPath);
  
  try {
    const path = require('path');
    const fs = require('fs');
    
    // Try standard locations
    const possibleLocations = [
      // In screenshots directory
      path.join(process.cwd(), 'screenshots', type, filename),
      
      // With or without type prefix
      path.join(process.cwd(), 'screenshots', type, `${type}-${filename}`),
      path.join(process.cwd(), 'screenshots', type, filename.replace(`${type}-`, '')),
      
      // In reports directory
      path.join(process.cwd(), 'reports', filename),
      path.join(process.cwd(), 'reports', `${type}-${filename}`),
      
      // In timestamp subdirectories
      ...findTimestampDirs(path.join(process.cwd(), 'screenshots', type), filename)
    ];
    
    // Check each location
    for (const location of possibleLocations) {
      if (fs.existsSync(location)) {
        alternatives.push(location);
      }
    }
  } catch (error) {
    logger.error(`Error finding alternative paths: ${error.message}`);
  }
  
  return alternatives;
}

/**
 * Find potential paths in timestamp directories
 * 
 * @param {string} parentDir - Parent directory
 * @param {string} filename - Filename to look for
 * @returns {Array<string>} - Array of potential paths
 */
function findTimestampDirs(parentDir, filename) {
  const result = [];
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check if parent directory exists
    if (!fs.existsSync(parentDir)) {
      return result;
    }
    
    // Get subdirectories
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const timestampDirs = entries
      .filter(entry => entry.isDirectory() && /\d{4}-\d{2}-\d{2}T/.test(entry.name))
      .map(entry => entry.name);
    
    // Check each timestamp directory
    for (const dir of timestampDirs) {
      const fullPath = path.join(parentDir, dir, filename);
      if (fs.existsSync(fullPath)) {
        result.push(fullPath);
      }
      
      // Also check with type prefix removed or added
      const nameWithoutPrefix = filename.replace(/^(baseline-|current-|diff-)/, '');
      const fullPathWithoutPrefix = path.join(parentDir, dir, nameWithoutPrefix);
      if (fs.existsSync(fullPathWithoutPrefix)) {
        result.push(fullPathWithoutPrefix);
      }
    }
  } catch (error) {
    logger.error(`Error searching timestamp directories: ${error.message}`);
  }
  
  return result;
}

/**
 * Creates an enhanced prompt for the multi-image visual model
 * 
 * @param {Object} comparisonResult - Result from image comparison
 * @returns {string} - Prompt for the visual model
 */
function createMultiImagePrompt(resultWithCorrectPaths) {
  // Make sure diffPixels exists, if not use diffPixelCount or calculate from percentage
  const diffPixels = resultWithCorrectPaths.diffPixels || 
                    resultWithCorrectPaths.diffPixelCount || 
                    Math.round((resultWithCorrectPaths.diffPercentage / 100) * (resultWithCorrectPaths.totalPixels || 1000000));
  
  return `You are an expert in visual UI testing with a focus on accuracy and avoiding false positives.

I'm showing you two images in this order:
1. The original baseline UI screenshot
2. The current UI screenshot with changes

The pixel comparison detected ${resultWithCorrectPaths.diffPercentage.toFixed(2)}% difference (${diffPixels} pixels).

IMPORTANT: In visual testing, avoiding false positives is critical. Only report issues if you are very confident they exist and would impact actual users. If you're unsure, err on the side of reporting no issues rather than false positives.

I need you to carefully analyze and determine if any of these specific UI bugs are ACTUALLY present:
1. TEXT TRUNCATION: ONLY report this if text is clearly and definitely cut off with ellipsis in the current version but was fully visible in the baseline
2. MISSING ELEMENTS: ONLY report this if buttons, icons, or UI components are completely missing in the current version
3. COLOR CONTRAST ISSUES: ONLY report this if there are clear color changes that make text significantly harder to read 
4. LAYOUT SHIFTS: ONLY report this if elements have moved significantly from their original positions in a way that would confuse users

DO NOT report issues when:
- Differences are minor or subtle (less than 1-2 pixels)
- Elements have moved only slightly
- Color changes are insignificant or maintain adequate contrast
- Text remains fully readable despite minor changes

If you identify a real issue, provide:
1. The specific UI element affected with clear evidence
2. The type of issue (one of the four categories above)
3. How it impacts usability with specific examples
4. Severity (High/Medium/Low)

Also answer these questions:
1. How significant are these changes to the user experience? 
2. Would these changes likely be intentional design updates or accidental regressions?
3. Are there any false positives in the detected changes?

If no significant issues are found, clearly state that no actionable UI bugs were detected and the differences are likely acceptable variations or testing artifacts.`;
}

/**
 * Creates a prompt for the visual model when only diff image is available
 * 
 * @param {Object} comparisonResult - Result from image comparison
 * @returns {string} - Prompt for the visual model
 */
function createVisualPrompt(comparisonResult) {
  // Make sure diffPixels exists, if not use diffPixelCount or calculate from percentage
  const diffPixels = comparisonResult.diffPixels || 
                    comparisonResult.diffPixelCount || 
                    Math.round((comparisonResult.diffPercentage / 100) * (comparisonResult.totalPixels || 1000000));
  
  return `You are an expert in visual UI testing with a focus on accuracy and avoiding false positives.
I'm showing you a visual difference map between a baseline UI screenshot and a current version.
Red pixels indicate differences between the two versions.

The diff represents ${comparisonResult.diffPercentage.toFixed(2)}% of the image (${diffPixels} pixels).

IMPORTANT: In visual testing, avoiding false positives is critical. Only report issues if you are very confident they exist and would impact actual users. If you're unsure, err on the side of reporting no issues rather than false positives.

I need you to carefully analyze if any of these specific UI bugs are ACTUALLY present:
1. TEXT TRUNCATION: ONLY report this if text appears to be clearly cut off in a way that would confuse users
2. MISSING ELEMENTS: ONLY report this if there are clear indicators of removed UI elements that would impact functionality
3. COLOR CONTRAST ISSUES: ONLY report this if there's evidence of significant color changes that would make text hard to read
4. LAYOUT SHIFTS: ONLY report this if you can confidently determine elements have moved significantly

DO NOT report issues when:
- Differences are minor or subtle (1-2 pixels)
- Elements have moved only slightly
- Color changes are insignificant
- Differences could be due to rendering artifacts

If you identify a real issue, please:
1. Describe the affected area of the UI with clear evidence
2. Classify the type of issue (one of the four categories above)
3. Estimate the severity (High/Medium/Low) based on actual user impact

Also consider:
1. How significant are these changes to the user experience? 
2. Would these changes likely be intentional design updates or accidental regressions?
3. Are there any false positives in the detected changes?

If no significant issues are found, clearly state that no actionable UI bugs were detected and the differences are likely acceptable variations or testing artifacts.`;
}

/**
 * Determines if a visual difference is likely a false positive
 * 
 * @param {Object} analysis - Enhanced analysis from analyzeVisualDifference
 * @returns {boolean} - Whether the difference is likely a false positive
 */
function isFalsePositive(analysis) {
  // If analysis explicitly flags as false positive
  if (analysis.falsePositive || analysis.isFalsePositive) {
    return true;
  }
  
  // If low severity with very small diff percentage
  if (analysis.severity === 'LOW' && analysis.diffPercentage && analysis.diffPercentage < 1.0) {
    return true;
  }
  
  // If the analysis text contains indicators of a false positive
  if (analysis.description) {
    const falsePositiveIndicators = [
      'false positive',
      'not significant',
      'minor difference',
      'negligible',
      'acceptable variation',
      'testing artifact',
      'no issues',
      'no real issues',
      'no significant issues',
      'no actionable issues'
    ];
    
    for (const indicator of falsePositiveIndicators) {
      if (analysis.description.toLowerCase().includes(indicator)) {
        return true;
      }
    }
  }
  
  // Return false by default (not a false positive)
  return false;
}

// Export functions
module.exports = {
  analyzeVisualDifference,
  isFalsePositive
};
