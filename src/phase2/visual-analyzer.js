/**
 * visual-analyzer.js
 * 
 * AI-powered analysis of visual differences using Ollama models.
 */

const path = require('path');
const fs = require('fs').promises;
const { analyzeImage, analyzeMultipleImages, generateText } = require('./ollama-client');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Get model names from config
const VISUAL_MODEL = getConfig('ai.visualModel', 'llava');
const TEXT_MODEL = getConfig('ai.textModel', 'llama3.2');

// Confidence threshold for AI analysis
const AI_THRESHOLD = getConfig('ai.threshold', 0.7);

/**
 * Analyzes visual differences between baseline and current screenshots
 * 
 * @param {Object} comparisonResult - Result from image comparison
 * @returns {Promise<Object>} - AI analysis of visual differences
 */
async function analyzeVisualDifference(comparisonResult) {
  logger.info('Analyzing visual difference using AI');
  
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
    let diffImagePath = comparisonResult.diffImagePath;
    let allImagesExist = true;
    
    // Ensure images exist and are readable
    try {
      const fs = require('fs');
      allImagesExist = fs.existsSync(baselineImagePath) && 
                       fs.existsSync(currentImagePath) && 
                       fs.existsSync(diffImagePath);
      
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
        
        if (!fs.existsSync(diffImagePath)) {
          const alternatives = findAlternativePaths(diffImagePath, 'diff');
          if (alternatives.length > 0) {
            diffImagePath = alternatives[0];
            logger.info(`Using alternative diff path: ${diffImagePath}`);
          }
        }
        
        // Check again with alternative paths
        allImagesExist = fs.existsSync(baselineImagePath) && 
                         fs.existsSync(currentImagePath) && 
                         fs.existsSync(diffImagePath);
      }
    } catch (fileError) {
      logger.error(`Error checking for images: ${fileError.message}`);
      allImagesExist = false;
    }
    
    if (!allImagesExist) {
      logger.error('Could not find all required images for multi-image analysis');
      logger.info('Falling back to diff-only analysis');
      
      // Fall back to diff-only analysis
      return fallbackToDiffOnlyAnalysis(comparisonResult, diffImagePath);
    }
    
    // Update the paths in the comparison result
    const resultWithCorrectPaths = {
      ...comparisonResult,
      baselineImagePath,
      currentImagePath,
      diffImagePath
    };
    
    // Create an enhanced prompt for the visual model that understands multiple images
    const prompt = createMultiImagePrompt(resultWithCorrectPaths);
    
    // Analyze all three images together
    logger.info('Analyzing baseline, current, and diff images together');
    const analysis = await analyzeMultipleImages(
      [baselineImagePath, currentImagePath, diffImagePath],
      prompt,
      VISUAL_MODEL
    );
    
    // Check if analysis contains error message
    if (analysis.includes('Error')) {
      logger.warn(`Multi-image AI analysis encountered an issue: ${analysis.substring(0, 100)}...`);
      logger.info('Falling back to diff-only analysis');
      
      // Fall back to diff-only analysis
      return fallbackToDiffOnlyAnalysis(comparisonResult, diffImagePath);
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
    
    // Try falling back to diff-only analysis
    try {
      return fallbackToDiffOnlyAnalysis(comparisonResult, comparisonResult.diffImagePath);
    } catch (fallbackError) {
      logger.error(`Fallback analysis also failed: ${fallbackError.message}`);
      
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
    VISUAL_MODEL
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

I'm showing you three images:
1. The original baseline UI screenshot
2. The current UI screenshot with changes
3. A visual difference map showing detected changes (red pixels indicate differences)

The diff represents ${resultWithCorrectPaths.diffPercentage.toFixed(2)}% of the image (${diffPixels} pixels).

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
 * Enhances the AI analysis with additional context and classification
 * 
 * @param {string} analysis - Raw analysis from the AI model
 * @param {Object} comparisonResult - Result from image comparison
 * @returns {Promise<Object>} - Enhanced analysis
 */
async function enhanceAnalysis(analysis, comparisonResult) {
  logger.debug('Enhancing AI analysis with additional context');
  
  try {
    // Check if analysis looks like an error message
    if (typeof analysis === 'string' && analysis.includes('Error')) {
      logger.warn(`Analysis contains error message: ${analysis.substring(0, 100)}...`);
      return {
        changeType: 'UNKNOWN',
        severity: comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                 comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW',
        affectedElements: ['Unknown'],
        intentional: null,
        falsePositive: false,
        isFalsePositive: false,
        confidence: 0.5,
        summary: 'Could not analyze changes due to AI error',
        description: analysis,
        rawAnalysis: analysis,
        meetsConfidenceThreshold: false,
        error: 'AI analysis failed'
      };
    }
    
    // Format the raw analysis into paragraphs
    const analysisLines = analysis.split('\n').filter(line => line.trim() !== '');
    const formattedAnalysis = analysisLines.join('\n\n');
    
    // Extract key elements from analysis text without using JSON
    const hasLayoutChanges = /layout|position|alignment|shift/i.test(analysis);
    const hasColorChanges = /color|hue|shade|tint|palette/i.test(analysis);
    const hasTextChanges = /text|font|typography|content/i.test(analysis);
    const hasSizeChanges = /size|dimension|width|height/i.test(analysis);
    
    // Detect affected elements
    const elementMatches = analysis.match(/button|input|header|nav|menu|form|card|image|icon|footer|container|section|div/gi) || [];
    const uniqueElements = [...new Set(elementMatches.map(e => e.charAt(0).toUpperCase() + e.slice(1).toLowerCase()))];
    
    // Determine if it's a false positive based on language in the analysis
    const falsePositiveKeywords = [
      'false positive', 
      'not significant', 
      'minor', 
      'negligible', 
      'rendering artifact', 
      'unlikely to affect', 
      'no significant issues',
      'no actionable issues',
      'acceptable variations',
      'testing artifacts',
      'not a real issue',
      'no ui bugs',
      'would not impact'
    ];
    
    const hasFalsePositiveMarkers = falsePositiveKeywords.some(keyword => 
      analysis.toLowerCase().includes(keyword)
    );
    
    // Also check for assertions that no issues were found
    const noIssuesFound = /no (issues|bugs|problems) (found|detected|identified)/i.test(analysis) ||
                         /i (don't|do not|cannot) (see|identify|find) any/i.test(analysis);
    
    // Determine if it's an intentional change
    const hasIntentionalMarkers = /intentional|deliberate|planned|design change|feature|improvement/i.test(analysis);
    
    // Determine change type
    let changeType = 'UNKNOWN';
    if (hasLayoutChanges && hasColorChanges) {
      changeType = 'MIXED';
    } else if (hasLayoutChanges) {
      changeType = 'LAYOUT';
    } else if (hasColorChanges) {
      changeType = 'COLOR';
    } else if (hasTextChanges) {
      changeType = 'TEXT';
    } else if (hasSizeChanges) {
      changeType = 'SIZE';
    }
    
    // Create a one-sentence summary from the first sentence of the analysis
    const firstSentenceMatch = analysis.match(/^([^.!?]+[.!?])/);
    const summary = firstSentenceMatch ? firstSentenceMatch[0].trim() : 
      `${comparisonResult.diffPercentage.toFixed(2)}% visual difference detected`;
    
    // Determine severity based on diff percentage and language in analysis
    let severity = comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                  comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW';
                  
    // If the analysis mentions severity, override the default
    if (/significant|major|critical|important/i.test(analysis)) {
      severity = 'HIGH';
    } else if (/moderate|medium/i.test(analysis)) {
      severity = 'MEDIUM';
    } else if (/minor|minimal|slight|small/i.test(analysis)) {
      severity = 'LOW';
    }
    
    // For small differences, default to false positive
    const isLikelyFalsePositive = hasFalsePositiveMarkers || noIssuesFound || 
                                (comparisonResult.diffPercentage < 1.0 && severity === 'LOW');
    
    return {
      changeType,
      severity,
      affectedElements: uniqueElements.length > 0 ? uniqueElements : ['UI Element'],
      intentional: hasIntentionalMarkers,
      falsePositive: isLikelyFalsePositive,
      isFalsePositive: isLikelyFalsePositive,
      confidence: isLikelyFalsePositive ? 0.9 : 0.8, 
      summary,
      description: formattedAnalysis,
      rawAnalysis: analysis,
      meetsConfidenceThreshold: true
    };
  } catch (error) {
    logger.error(`Error enhancing analysis: ${error.message}`);
    logger.error(error.stack);
    
    // Return basic structure with original analysis
    return createDefaultAnalysis(comparisonResult, analysis);
  }
}

/**
 * Creates a default analysis object when AI enhancement fails
 * 
 * @param {Object} comparisonResult - Result from image comparison 
 * @param {string} analysis - Original analysis text
 * @returns {Object} - Default analysis object
 */
function createDefaultAnalysis(comparisonResult, analysis) {
  try {
    // Be more conservative with default analysis
    const isSmallDifference = comparisonResult.diffPercentage < 1.0;
    
    // For color changes, typically many small differences are spread throughout the UI
    const isLikelyColorChange = comparisonResult.diffPercentage < 3.0 && 
                             comparisonResult.diffPercentage > 0.2 && 
                             (comparisonResult.diffPixels || comparisonResult.diffPixelCount) > 500;
    
    // Extract any mention of elements from the analysis
    const elementMatches = analysis ? analysis.match(/button|header|nav|menu|form|card|image|text|footer|container|section|div/gi) : [];
    const uniqueElements = elementMatches ? [...new Set(elementMatches.map(e => e.charAt(0).toUpperCase() + e.slice(1).toLowerCase()))] : ['UI Elements'];
    
    // Determine severity based on diff percentage
    const severity = comparisonResult.diffPercentage > 5 ? 'HIGH' : 
                   comparisonResult.diffPercentage > 1 ? 'MEDIUM' : 'LOW';
    
    // Create a proper summary based on available information
    const summary = isSmallDifference 
      ? 'Minor visual differences detected, likely not significant' 
      : (isLikelyColorChange 
        ? 'Color changes detected in UI elements' 
        : `${comparisonResult.diffPercentage.toFixed(2)}% visual difference detected`);
    
    // Create a more detailed description
    const description = analysis && analysis.length > 100 
      ? analysis 
      : isSmallDifference
        ? `Visual analysis detected ${comparisonResult.diffPixels || comparisonResult.diffPixelCount || 0} changed pixels (${comparisonResult.diffPercentage.toFixed(2)}% of total). These differences are minor and likely would not impact user experience.`
        : `Visual analysis detected ${comparisonResult.diffPixels || comparisonResult.diffPixelCount || 0} changed pixels (${comparisonResult.diffPercentage.toFixed(2)}% of total).`;
    
    return {
      changeType: isLikelyColorChange ? 'COLOR' : 'MIXED',
      severity: severity,
      affectedElements: uniqueElements.slice(0, 5), // Limit to 5 elements
      intentional: !isSmallDifference,
      falsePositive: isSmallDifference,
      isFalsePositive: isSmallDifference,
      confidence: isSmallDifference ? 0.8 : 0.6, // Higher confidence for small differences being false positives
      summary: summary,
      description: description,
      rawAnalysis: analysis || 'No analysis available',
      meetsConfidenceThreshold: isSmallDifference, // Small differences more confidently classified
      isDefaultAnalysis: true
    };
  } catch (error) {
    logger.error(`Error creating default analysis: ${error.message}`);
    
    // Return a minimal valid analysis if something goes wrong
    return {
      changeType: 'MIXED',
      severity: 'LOW',
      affectedElements: ['UI Elements'],
      intentional: false,
      falsePositive: comparisonResult.diffPercentage < 1.0,
      isFalsePositive: comparisonResult.diffPercentage < 1.0,
      confidence: 0.5,
      summary: `${comparisonResult.diffPercentage ? comparisonResult.diffPercentage.toFixed(2) : '0.00'}% visual difference detected`,
      description: comparisonResult.diffPercentage < 1.0 
        ? 'Minor visual differences detected, likely not significant'
        : 'Visual difference detected in the UI',
      rawAnalysis: 'Error generating analysis',
      meetsConfidenceThreshold: false,
      isDefaultAnalysis: true,
      isErrorAnalysis: true
    };
  }
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
