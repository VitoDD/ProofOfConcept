/**
 * ai-workflow.test.js
 * 
 * Tests for the AI workflow integration.
 * Note: These tests will be skipped if Ollama is not available.
 */

const { 
  runAiVisualTestingWorkflow,
  checkAiAvailability
} = require('../../src/phase2/ai-workflow');
const { introduceVisualBug, revertVisualBugs } = require('../../src/phase1/create-visual-bug');
const fs = require('fs');
const path = require('path');

// Timeout for workflow operations
jest.setTimeout(120000);

describe('AI Visual Testing Workflow', () => {
  let aiAvailable = false;
  
  // Check if AI is available before tests
  beforeAll(async () => {
    try {
      aiAvailable = await checkAiAvailability();
      
      if (!aiAvailable) {
        console.warn('AI is not available, tests will run with AI analysis skipped');
      }
    } catch (error) {
      console.warn('Error checking AI availability:', error.message);
      aiAvailable = false;
    }
  });
  
  // Revert any visual bugs after tests
  afterAll(async () => {
    try {
      await revertVisualBugs();
    } catch (error) {
      console.error('Error reverting visual bugs:', error.message);
    }
  });
  
  test('runAiVisualTestingWorkflow successfully executes the workflow', async () => {
    // Run workflow with AI skipped if not available
    const result = await runAiVisualTestingWorkflow({
      captureBaseline: true,
      introduceBug: true,
      bugType: 'color',
      skipAiAnalysis: !aiAvailable,
      forceContinue: true
    });
    
    // Check workflow result
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    
    // Check that report was generated
    expect(result).toHaveProperty('reportPath');
    expect(fs.existsSync(result.reportPath)).toBe(true);
    
    // Check results array
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
    
    // Check if AI analysis was applied
    expect(result).toHaveProperty('aiAnalysisApplied');
    
    if (aiAvailable && !result.aiAnalysisApplied) {
      console.warn('AI is available but analysis was not applied. Check Ollama configuration.');
    }
    
    // If AI analysis was applied, check that results contain AI data
    if (result.aiAnalysisApplied) {
      const hasAiAnalysis = result.results.some(r => r.aiAnalysis);
      expect(hasAiAnalysis).toBe(true);
    }
  });
  
  test('runAiVisualTestingWorkflow falls back to basic workflow if AI is skipped', async () => {
    // Run workflow with AI explicitly skipped
    const result = await runAiVisualTestingWorkflow({
      skipAiAnalysis: true,
      forceContinue: true
    });
    
    // Check workflow result
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    
    // Check that report was generated
    expect(result).toHaveProperty('reportPath');
    expect(fs.existsSync(result.reportPath)).toBe(true);
    
    // Check that AI analysis was not applied
    expect(result.aiAnalysisApplied).toBe(false);
  });
});
