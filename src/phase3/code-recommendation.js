/**
 * code-recommendation.js
 * 
 * Generates recommendations for fixing visual issues based on
 * code analysis and AI assistance.
 */

const fs = require('fs').promises;
const path = require('path');
const { generateText } = require('../phase2/ollama-client');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Represents a code recommendation for fixing a visual issue
 */
class CodeRecommendation {
  constructor(issue, generatedBy = 'auto') {
    this.issue = issue;
    this.recommendations = [];
    this.generatedBy = generatedBy;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Add a recommendation
   * 
   * @param {string} description - Description of the recommendation
   * @param {Object} codeChange - Specific code change suggested
   * @param {number} confidence - Confidence level (0-1)
   */
  addRecommendation(description, codeChange = null, confidence = 0.5) {
    this.recommendations.push({
      description,
      codeChange,
      confidence,
      id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    });
    
    // Sort recommendations by confidence (highest first)
    this.recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get the top recommendation
   * 
   * @returns {Object|null} The top recommendation or null if none exist
   */
  getTopRecommendation() {
    return this.recommendations.length > 0 ? this.recommendations[0] : null;
  }

  /**
   * Convert to a simple object for serialization
   * 
   * @returns {Object} Simple object representation
   */
  toObject() {
    return {
      recommendations: this.recommendations,
      generatedBy: this.generatedBy,
      timestamp: this.timestamp,
      issueType: this.issue.aiAnalysis?.changeType || 'UNKNOWN',
      issueSeverity: this.issue.aiAnalysis?.severity || 'UNKNOWN',
      referencedElements: this.issue.affectedElements.map(el => el.selector)
    };
  }
}

/**
 * Generates code recommendations for fixing visual issues
 */
class CodeRecommendationGenerator {
  /**
   * Creates a new code recommendation generator
   * 
   * @param {Object} options - Generator options
   */
  constructor(options = {}) {
    this.options = {
      aiModel: getConfig('ai.textModel', 'llama3.2'),
      aiTemperature: 0.2,
      confidenceThreshold: 0.6,
      ...options
    };
  }

  /**
   * Add fallback recommendations when AI fails
   * 
   * @param {Object} issue - The localized issue
   * @param {CodeRecommendation} recommendation - The recommendation to enhance
   * @param {Array} codeSnippets - Code snippets to use
   */
  addFallbackRecommendations(issue, recommendation, codeSnippets) {
    logger.info('Adding fallback recommendations due to AI failure');
    
    const changeType = issue.aiAnalysis?.changeType || 'UNKNOWN';
    
    // Add generic recommendations based on issue type
    if (changeType === 'COLOR') {
      // For each CSS snippet, look for color-related properties
      codeSnippets.forEach(snippet => {
        if (snippet.language === 'css') {
          // Look for color properties in the snippet content
          const hasColorProps = /color|background|rgb|rgba|hsl|#[0-9a-f]{3,6}/i.test(snippet.content);
          
          if (hasColorProps) {
            recommendation.addRecommendation(
              `Check color properties in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber}`,
              {
                filePath: snippet.filePath,
                lineNumber: snippet.lineNumber,
                currentContent: snippet.content,
                suggestedFix: 'Review color values to ensure they match the intended design'
              },
              0.75
            );
          } else {
            recommendation.addRecommendation(
              `Examine CSS in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber}`,
              {
                filePath: snippet.filePath,
                lineNumber: snippet.lineNumber,
                currentContent: snippet.content,
                suggestedFix: 'Check for color-related properties that may need adjustment'
              },
              0.65
            );
          }
        }
      });
    } else if (changeType === 'LAYOUT') {
      // For each CSS snippet, look for layout-related properties
      codeSnippets.forEach(snippet => {
        if (snippet.language === 'css') {
          // Look for layout properties in the snippet content
          const hasLayoutProps = /margin|padding|position|display|flex|grid|width|height/i.test(snippet.content);
          
          if (hasLayoutProps) {
            recommendation.addRecommendation(
              `Check layout properties in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber}`,
              {
                filePath: snippet.filePath,
                lineNumber: snippet.lineNumber,
                currentContent: snippet.content,
                suggestedFix: 'Review layout values to ensure they match the intended design'
              },
              0.75
            );
          } else {
            recommendation.addRecommendation(
              `Examine CSS in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber}`,
              {
                filePath: snippet.filePath,
                lineNumber: snippet.lineNumber,
                currentContent: snippet.content,
                suggestedFix: 'Check for layout-related properties that may need adjustment'
              },
              0.65
            );
          }
        }
      });
    } else if (changeType === 'TEXT') {
      // For each HTML or JS snippet, look for text content
      codeSnippets.forEach(snippet => {
        if (['html', 'js', 'jsx'].includes(snippet.language)) {
          // Look for text content in the snippet
          const hasText = />([^<]+)<\/|["']([^"']+)["']/.test(snippet.content);
          
          if (hasText) {
            recommendation.addRecommendation(
              `Check text content in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber}`,
              {
                filePath: snippet.filePath,
                lineNumber: snippet.lineNumber,
                currentContent: snippet.content,
                suggestedFix: 'Review text content to ensure it matches the intended message'
              },
              0.75
            );
          } else {
            recommendation.addRecommendation(
              `Examine content in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber}`,
              {
                filePath: snippet.filePath,
                lineNumber: snippet.lineNumber,
                currentContent: snippet.content,
                suggestedFix: 'Check for text content that may need adjustment'
              },
              0.65
            );
          }
        }
      });
    } else {
      // Generic recommendation
      if (codeSnippets.length > 0) {
        const snippet = codeSnippets[0];
        recommendation.addRecommendation(
          `Review code in ${path.basename(snippet.filePath)} near line ${snippet.lineNumber} for visual changes`,
          {
            filePath: snippet.filePath,
            lineNumber: snippet.lineNumber,
            currentContent: snippet.content,
            suggestedFix: 'Compare with baseline version to identify changes'
          },
          0.7
        );
      }
    }
    
    // Add a general recommendation
    recommendation.addRecommendation(
      'Compare the current implementation with the baseline to identify visual differences',
      null,
      0.5
    );
  }

  /**
   * Generate recommendations for a localized issue
   * 
   * @param {Object} issue - The localized issue
   * @returns {Promise<CodeRecommendation>} Generated recommendations
   */
  async generateRecommendations(issue) {
    logger.info('Generating code recommendations...');
    
    const recommendation = new CodeRecommendation(issue);
    
    try {
      // First, add recommendations from the issue itself
      for (const rec of issue.recommendations) {
        recommendation.addRecommendation(rec.text, rec.codeChange, rec.confidence);
      }
      
      // If there are no recommendations yet or confidence is low, use AI
      const topRec = recommendation.getTopRecommendation();
      if (!topRec || topRec.confidence < this.options.confidenceThreshold) {
        await this.enhanceWithAi(issue, recommendation);
      }
      
      logger.info(`Generated ${recommendation.recommendations.length} recommendations`);
      
      return recommendation;
    } catch (error) {
      logger.error(`Error generating recommendations: ${error.message}`);
      
      // Add a fallback recommendation
      recommendation.addRecommendation(
        'Review the code for visual changes and compare with baseline.',
        null,
        0.5
      );
      
      return recommendation;
    }
  }

  /**
   * Enhance recommendations using AI
   * 
   * @param {Object} issue - The localized issue
   * @param {CodeRecommendation} recommendation - The recommendation to enhance
   */
  async enhanceWithAi(issue, recommendation) {
    logger.info('Enhancing recommendations with AI...');
    
    // Get code snippets for the top references
    const codeSnippets = await this.getCodeSnippets(issue);
    
    if (codeSnippets.length === 0) {
      logger.warn('No code snippets found for AI enhancement');
      
      // Add a simple recommendation based on the issue type if available
      if (issue.aiAnalysis?.changeType) {
        const changeType = issue.aiAnalysis.changeType;
        let desc = '';
        
        if (changeType === 'COLOR') {
          desc = 'Check for color-related CSS properties that may have changed.';
        } else if (changeType === 'LAYOUT') {
          desc = 'Verify layout properties like margin, padding, or position that may have changed.';
        } else if (changeType === 'TEXT') {
          desc = 'Look for text content changes in the HTML or component code.';
        } else {
          desc = `Review code related to this ${changeType} type visual change.`;
        }
        
        recommendation.addRecommendation(desc, null, 0.6);
      }
      
      return;
    }
    
    try {
      // Create a prompt for the AI
      const prompt = this.createAiPrompt(issue, codeSnippets);
      
      // Set a timeout for AI response
      const timeoutMs = 120000; // 2 minutes
      
      // Generate recommendations using AI with timeout
      let aiResponse;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        aiResponse = await generateText(
          prompt,
          this.options.aiModel,
          { 
            temperature: this.options.aiTemperature,
            signal: controller.signal 
          }
        );
        
        clearTimeout(timeoutId);
      } catch (error) {
        logger.error(`AI request failed or timed out: ${error.message}`);
        
        // Add a fallback recommendation when AI fails
        this.addFallbackRecommendations(issue, recommendation, codeSnippets);
        return;
      }
      
      // Parse AI response
      const parsedRecommendations = this.parseAiResponse(aiResponse);
      
      // Add parsed recommendations
      for (const rec of parsedRecommendations) {
        recommendation.addRecommendation(
          rec.description,
          rec.codeChange,
          rec.confidence
        );
      }
      
      logger.info(`Added ${parsedRecommendations.length} AI-enhanced recommendations`);
    } catch (error) {
      logger.error(`Error enhancing recommendations with AI: ${error.message}`);
    }
  }

  /**
   * Get code snippets for the top references
   * 
   * @param {Object} issue - The localized issue
   * @returns {Promise<Array>} Array of code snippets
   */
  async getCodeSnippets(issue) {
    const snippets = [];
    
    // Use top 3 references at most
    const topRefs = issue.getSortedCodeReferences().slice(0, 3);
    
    for (const ref of topRefs) {
      try {
        const content = await fs.readFile(ref.filePath, 'utf-8');
        const lines = content.split('\n');
        
        // Get a context window of lines around the reference
        const startLine = Math.max(0, ref.lineNumber - 6);
        const endLine = Math.min(lines.length - 1, ref.lineNumber + 5);
        
        snippets.push({
          filePath: ref.filePath,
          lineNumber: ref.lineNumber,
          content: lines.slice(startLine, endLine + 1).join('\n'),
          startLine: startLine + 1, // Convert to 1-indexed
          endLine: endLine + 1, // Convert to 1-indexed
          language: path.extname(ref.filePath).substring(1)
        });
      } catch (error) {
        logger.error(`Error reading file ${ref.filePath}: ${error.message}`);
      }
    }
    
    return snippets;
  }

  /**
   * Create a prompt for the AI
   * 
   * @param {Object} issue - The localized issue
   * @param {Array} codeSnippets - Code snippets to include
   * @returns {string} The prompt for the AI
   */
  createAiPrompt(issue, codeSnippets) {
    const changeType = issue.aiAnalysis?.changeType || 'UNKNOWN';
    const severity = issue.aiAnalysis?.severity || 'UNKNOWN';
    const description = issue.aiAnalysis?.description || 'Unknown issue';
    
    let prompt = `You are an expert web developer tasked with fixing visual UI issues.

VISUAL ISSUE DETAILS:
- Type: ${changeType}
- Severity: ${severity}
- Description: ${description}

CODE SNIPPETS THAT MAY CONTAIN THE ISSUE:
`;

    codeSnippets.forEach((snippet, index) => {
      prompt += `\nSNIPPET ${index + 1} (${snippet.filePath}, line ${snippet.lineNumber}):\n`;
      prompt += '```' + snippet.language + '\n';
      prompt += snippet.content + '\n';
      prompt += '```\n';
    });
    
    prompt += `
Based on the visual issue and code snippets, provide recommendations to fix the issue.
For each recommendation, include:
1. A clear description of what needs to be changed
2. The specific file and line number where the change should be made
3. The exact code change to implement (before and after)
4. A confidence level (0.0-1.0) of how likely this recommendation is to fix the issue

Format your response as a JSON array of recommendations.
Example:
[
  {
    "description": "Change the button color from blue to green",
    "filePath": "styles.css",
    "lineNumber": 42,
    "beforeCode": "  color: #0000FF;",
    "afterCode": "  color: #00FF00;",
    "confidence": 0.85
  }
]
`;

    return prompt;
  }

  /**
   * Parse AI response into recommendations
   * 
   * @param {string} aiResponse - The AI response
   * @returns {Array} Parsed recommendations
   */
  parseAiResponse(aiResponse) {
    try {
      // Extract JSON array from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }
      
      const jsonArray = JSON.parse(jsonMatch[0]);
      
      return jsonArray.map(item => ({
        description: item.description,
        codeChange: {
          filePath: item.filePath,
          lineNumber: item.lineNumber,
          currentContent: item.beforeCode,
          suggestedFix: item.afterCode
        },
        confidence: item.confidence || 0.7
      }));
    } catch (error) {
      logger.error(`Error parsing AI response: ${error.message}`);
      
      // Try a simpler parsing approach for non-JSON responses
      const recommendations = [];
      
      // Look for lines that may contain recommendations
      const lines = aiResponse.split('\n');
      let currentRec = null;
      
      for (const line of lines) {
        if (line.startsWith('- ') || line.startsWith('* ')) {
          // New recommendation
          if (currentRec) {
            recommendations.push(currentRec);
          }
          
          currentRec = {
            description: line.substring(2).trim(),
            codeChange: null,
            confidence: 0.6
          };
        } else if (currentRec && (line.includes(':') || line.includes('='))) {
          // Possible code suggestion
          currentRec.codeChange = {
            suggestedFix: line.trim()
          };
        }
      }
      
      // Add the last recommendation if exists
      if (currentRec) {
        recommendations.push(currentRec);
      }
      
      return recommendations;
    }
  }
}

module.exports = {
  CodeRecommendation,
  CodeRecommendationGenerator
};
