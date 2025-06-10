/**
 * Utility functions for flexible line matching in fix application
 */

const logger = require('../../utils/logger');

/**
 * Find the best matching line in an array of lines
 * @param {Array} lines - Array of lines to search
 * @param {string} targetContent - Content to match
 * @returns {Object} - Best match result with index and score
 */
function findBestMatchingLine(lines, targetContent) {
  const targetTrimmed = targetContent.trim();
  let bestScore = 0;
  let bestIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const score = calculateSimilarity(line, targetTrimmed);
    
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  
  return { index: bestIndex, score: bestScore };
}

/**
 * Calculate similarity between two strings (0 to 1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Normalize strings for better matching
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();
  
  // Exact match after normalization
  if (s1 === s2) return 1.0;
  
  // Check if one is a subset of the other (for CSS properties)
  if (s1.includes(s2) || s2.includes(s1)) {
    const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    // Higher similarity for subset relationship
    return 0.5 + (ratio * 0.5);
  }
  
  // Enhanced implementation - count common characters with position weighting
  const commonChars = countCommonCharacters(s1, s2);
  return commonChars / Math.max(s1.length, s2.length);
}

/**
 * Count common characters between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Number of common characters
 */
function countCommonCharacters(str1, str2) {
  let common = 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Count common characters (simplistic approach)
  for (let i = 0; i < s1.length; i++) {
    if (s2.includes(s1[i])) {
      common++;
    }
  }
  
  return common;
}

/**
 * Find CSS-specific matches in lines of code
 * @param {string[]} lines - Array of code lines
 * @param {string} content - Content to match
 * @param {Function} callback - Callback when match found
 * @returns {boolean} - True if match found
 */
function findCssMatch(lines, content, callback) {
  const trimmedContent = content.trim();
  
  // Try to match CSS property
  const propertyMatch = trimmedContent.match(/^\s*([a-zA-Z-]+)\s*:/);
  if (propertyMatch && propertyMatch[1]) {
    const propertyName = propertyMatch[1];
    
    // Find lines with this property
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`${propertyName}:`)) {
        callback(i);
        logger.info(`Found CSS property match for "${propertyName}" at line ${i+1}`);
        return true;
      }
    }
  }
  
  // Try to match CSS selector
  const selectorMatch = trimmedContent.match(/^\s*([\.\#][a-zA-Z0-9_-]+)\s*\{/);
  if (selectorMatch && selectorMatch[1]) {
    const selector = selectorMatch[1];
    
    // Find this selector in the file
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(selector) && lines[i].includes('{')) {
        callback(i);
        logger.info(`Found CSS selector match for "${selector}" at line ${i+1}`);
        return true;
      }
    }
  }
  
  // Try to match color values
  const colorMatch = trimmedContent.match(/\#[0-9a-fA-F]{3,6}/);
  if (colorMatch && colorMatch[0]) {
    const colorValue = colorMatch[0];
    
    // Find lines with this color
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(colorValue)) {
        callback(i);
        logger.info(`Found CSS color match for "${colorValue}" at line ${i+1}`);
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Verify line content with flexible matching
 * @param {string[]} lines - File lines
 * @param {number} lineNumber - Line number (1-based)
 * @param {string} expectedContent - Expected content
 * @returns {Object} - Verification result
 */
function verifyLineContent(lines, lineNumber, expectedContent) {
  // Convert to 0-based index
  const lineIndex = lineNumber - 1;
  
  // Check if line number is valid
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return {
      match: false,
      actualContent: '',
      reason: 'Line number out of range'
    };
  }
  
  // Get the actual content
  const actualContent = lines[lineIndex];
  
  // Check for exact match (after trimming)
  if (actualContent.trim() === expectedContent.trim()) {
    return {
      match: true,
      actualContent,
      reason: 'Exact match'
    };
  }
  
  // Try fuzzy matching
  const similarity = calculateSimilarity(actualContent, expectedContent);
  if (similarity > 0.7) {
    return {
      match: true,
      actualContent,
      similarity,
      reason: 'Fuzzy match'
    };
  }
  
  // Find the best matching line
  const bestMatch = findBestMatchingLine(lines, expectedContent);
  if (bestMatch.score > 0.7) {
    return {
      match: true,
      actualContent: lines[bestMatch.index],
      lineNumber: bestMatch.index + 1,
      similarity: bestMatch.score,
      reason: 'Best matching line'
    };
  }
  
  // Try CSS-specific matching
  let cssMatch = null;
  const cssMatched = findCssMatch(lines, expectedContent, (matchedIndex) => {
    cssMatch = {
      match: true,
      actualContent: lines[matchedIndex],
      lineNumber: matchedIndex + 1,
      reason: 'CSS-specific match'
    };
  });
  
  if (cssMatched && cssMatch) {
    return cssMatch;
  }
  
  // No match found
  return {
    match: false,
    actualContent,
    reason: 'No match found'
  };
}

module.exports = {
  findBestMatchingLine,
  calculateSimilarity,
  findCssMatch,
  verifyLineContent
};
