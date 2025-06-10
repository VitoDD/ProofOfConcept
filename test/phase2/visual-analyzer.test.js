/**
 * visual-analyzer.test.js
 * 
 * Tests for the visual analyzer.
 * Note: These tests will be skipped if Ollama is not available.
 */

const { 
  analyzeVisualDifference,
  isFalsePositive
} = require('../../src/phase2/visual-analyzer');
const { checkOllamaStatus } = require('../../src/phase2/ollama-client');
const { compareImages } = require('../../src/phase1/compare');
const path = require('path');
const fs = require('fs');

// Timeout for AI operations
jest.setTimeout(60000);

// Test images directory
const TEST_IMAGES_DIR = path.join(__dirname, '../phase1/test-images');
const RESULTS_DIR = path.join(__dirname, '../../reports');

// Ensure directories exist
beforeAll(() => {
  if (!fs.existsSync(TEST_IMAGES_DIR)) {
    fs.mkdirSync(TEST_IMAGES_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
});

describe('Visual Analyzer', () => {
  let ollamaAvailable = false;
  let requiredModelsAvailable = false;
  
  // Check if Ollama is available before tests
  beforeAll(async () => {
    try {
      const status = await checkOllamaStatus();
      ollamaAvailable = status.available;
      
      if (ollamaAvailable) {
        requiredModelsAvailable = status.allModelsAvailable;
        
        if (!requiredModelsAvailable) {
          console.warn('Required models are not available:', status.missingModels);
        }
      } else {
        console.warn('Ollama is not available, tests will be skipped');
      }
    } catch (error) {
      console.warn('Error checking Ollama status:', error.message);
      ollamaAvailable = false;
    }
  });
  
  test('analyzeVisualDifference returns analysis for images with differences', async () => {
    // Skip if Ollama or required models are not available
    if (!ollamaAvailable || !requiredModelsAvailable) {
      console.log('Skipping test - Ollama or required models not available');
      return;
    }
    
    // First, create a comparison result
    const baselinePath = path.join(TEST_IMAGES_DIR, 'identical1.png');
    const currentPath = path.join(TEST_IMAGES_DIR, 'different.png');
    const diffPath = path.join(RESULTS_DIR, 'test-analyzer-diff.png');
    
    // Compare images
    const comparisonResult = await compareImages(baselinePath, currentPath, diffPath);
    
    // Run AI analysis
    const analysis = await analyzeVisualDifference(comparisonResult);
    
    // Verify analysis structure
    expect(analysis).toHaveProperty('hasDifferences');
    expect(analysis.hasDifferences).toBe(true);
    
    // If we received the enhanced analysis, check its structure
    if (analysis.changeType) {
      expect(analysis).toHaveProperty('changeType');
      expect(analysis).toHaveProperty('severity');
      expect(analysis).toHaveProperty('confidence');
      expect(analysis).toHaveProperty('summary');
    } else {
      // Sometimes the AI might not provide structured output
      expect(analysis).toHaveProperty('analysis');
      expect(typeof analysis.analysis).toBe('string');
    }
  });
  
  test('analyzeVisualDifference handles images without differences', async () => {
    // Skip if Ollama or required models are not available
    if (!ollamaAvailable || !requiredModelsAvailable) {
      console.log('Skipping test - Ollama or required models not available');
      return;
    }
    
    // Create a comparison result with identical images
    const baselinePath = path.join(TEST_IMAGES_DIR, 'identical1.png');
    const currentPath = path.join(TEST_IMAGES_DIR, 'identical2.png');
    const diffPath = path.join(RESULTS_DIR, 'test-analyzer-identical-diff.png');
    
    // Compare identical images
    const comparisonResult = await compareImages(baselinePath, currentPath, diffPath);
    
    // Run AI analysis
    const analysis = await analyzeVisualDifference(comparisonResult);
    
    // Should report no differences
    expect(analysis).toHaveProperty('hasDifferences');
    expect(analysis.hasDifferences).toBe(false);
  });
  
  test('isFalsePositive correctly identifies false positives', () => {
    // Test with a high-confidence false positive
    const highConfidenceFalsePositive = {
      changeType: 'COLOR',
      severity: 'LOW',
      confidence: 0.9,
      falsePositive: true,
      meetsConfidenceThreshold: true
    };
    
    expect(isFalsePositive(highConfidenceFalsePositive)).toBe(true);
    
    // Test with a low-severity change that is not marked as false positive
    const lowSeverityChange = {
      changeType: 'COLOR',
      severity: 'LOW',
      confidence: 0.9,
      falsePositive: false,
      meetsConfidenceThreshold: true
    };
    
    expect(isFalsePositive(lowSeverityChange)).toBe(false);
    
    // Test with a high-severity change
    const highSeverityChange = {
      changeType: 'LAYOUT',
      severity: 'HIGH',
      confidence: 0.9,
      falsePositive: false,
      meetsConfidenceThreshold: true
    };
    
    expect(isFalsePositive(highSeverityChange)).toBe(false);
    
    // Test with low confidence
    const lowConfidence = {
      changeType: 'COLOR',
      severity: 'LOW',
      confidence: 0.3,
      falsePositive: true,
      meetsConfidenceThreshold: false
    };
    
    expect(isFalsePositive(lowConfidence)).toBe(false);
  });
});
