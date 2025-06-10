/**
 * ai-report.test.js
 * 
 * Tests for the AI report generator.
 */

const { generateAiReport } = require('../../src/phase2/ai-report');
const path = require('path');
const fs = require('fs');

// Report directory
const REPORTS_DIR = path.join(__dirname, '../../reports');

// Ensure reports directory exists
beforeAll(() => {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
});

describe('AI Report Generator', () => {
  test('generateAiReport creates an HTML report from results with AI analysis', async () => {
    // Mock comparison results with AI analysis
    const mockResults = [
      {
        name: 'test-1.png',
        baselineImagePath: path.join(__dirname, '../phase1/test-images/identical1.png'),
        currentImagePath: path.join(__dirname, '../phase1/test-images/different.png'),
        diffImagePath: path.join(REPORTS_DIR, 'test-report-diff-1.png'),
        diffPixels: 400,
        totalPixels: 10000,
        diffPercentage: 4,
        hasDifferences: true,
        aiAnalysis: {
          hasDifferences: true,
          changeType: 'COLOR',
          severity: 'MEDIUM',
          affectedElements: ['Red square'],
          intentional: true,
          falsePositive: false,
          confidence: 0.85,
          summary: 'A red square has been added to the center of the image',
          description: 'There is a 20x20 pixel red square in the center of the current image that was not present in the baseline.',
          rawAnalysis: 'The image shows a difference where a red square has been added to the center.',
          meetsConfidenceThreshold: true,
          isFalsePositive: false
        }
      },
      {
        name: 'test-2.png',
        baselineImagePath: path.join(__dirname, '../phase1/test-images/identical1.png'),
        currentImagePath: path.join(__dirname, '../phase1/test-images/identical2.png'),
        diffImagePath: path.join(REPORTS_DIR, 'test-report-diff-2.png'),
        diffPixels: 0,
        totalPixels: 10000,
        diffPercentage: 0,
        hasDifferences: false,
        aiAnalysis: {
          hasDifferences: false,
          analysis: 'No visual differences detected'
        }
      },
      {
        name: 'test-3.png',
        baselineImagePath: path.join(__dirname, '../phase1/test-images/identical1.png'),
        currentImagePath: path.join(__dirname, '../phase1/test-images/different.png'),
        diffImagePath: path.join(REPORTS_DIR, 'test-report-diff-3.png'),
        diffPixels: 50,
        totalPixels: 10000,
        diffPercentage: 0.5,
        hasDifferences: true,
        aiAnalysis: {
          hasDifferences: true,
          changeType: 'COLOR',
          severity: 'LOW',
          affectedElements: ['Minor pixel changes'],
          intentional: false,
          falsePositive: true,
          confidence: 0.9,
          summary: 'Minor rendering differences that do not affect functionality',
          description: 'These are small anti-aliasing differences that are not perceptible to users.',
          rawAnalysis: 'The image shows minimal differences likely due to rendering variations.',
          meetsConfidenceThreshold: true,
          isFalsePositive: true
        }
      }
    ];
    
    // Generate report
    const reportPath = await generateAiReport(mockResults);
    
    // Check that the report file exists
    expect(fs.existsSync(reportPath)).toBe(true);
    
    // Check report content
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    
    // Verify that the report contains expected elements
    expect(reportContent).toContain('AI-Enhanced Visual Testing Report');
    expect(reportContent).toContain('AI Insights');
    expect(reportContent).toContain('A red square has been added');
    expect(reportContent).toContain('FALSE POSITIVE');
    
    // Verify that the report contains stats
    expect(reportContent).toContain('Total comparisons: <strong>3</strong>');
    
    // Verify image paths
    expect(reportContent).toContain('test-report-diff-1.png');
  });
});
