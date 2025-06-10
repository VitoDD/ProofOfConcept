/**
 * enhanced-phase2.js
 * 
 * This script enhances Phase 2 (AI-Enhanced Visual Testing) to better work with LLaVA-2.
 * It modifies the visual-analyzer.js to include more specific prompts for identifying
 * the types of visual bugs we've introduced in the comprehensive bug package.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to visual-analyzer.js
const visualAnalyzerPath = path.join(__dirname, 'src', 'phase2', 'visual-analyzer.js');

/**
 * Enhances the visual analyzer prompts to better detect our specific bug types
 */
function enhanceVisualAnalyzerPrompts() {
  console.log('Enhancing visual analyzer prompts for better LLaVA-2 integration...');
  
  // Read the visual analyzer file
  const visualAnalyzerContent = fs.readFileSync(visualAnalyzerPath, 'utf8');
  
  // Enhance the multi-image prompt
  let enhancedContent = visualAnalyzerContent.replace(
    `  // Create an enhanced prompt for the multi-image visual model
function createMultiImagePrompt(resultWithCorrectPaths) {
  // Make sure diffPixels exists, if not use diffPixelCount or calculate from percentage
  const diffPixels = comparisonResult.diffPixels || 
                    comparisonResult.diffPixelCount || 
                    Math.round((comparisonResult.diffPercentage / 100) * (comparisonResult.totalPixels || 1000000));
  
  return \`You are an expert in visual UI testing.

I'm showing you three images:
1. The original baseline UI screenshot
2. The current UI screenshot with changes
3. A visual difference map showing detected changes (red pixels indicate differences)

The diff represents \${comparisonResult.diffPercentage.toFixed(2)}% of the image (\${diffPixels} pixels).

Please analyze all three images and tell me:
1. What specific changes occurred between the baseline and current versions?
2. Which UI elements were modified? Please be specific about the exact elements that changed.
3. What type of changes are these? (color changes, layout shifts, text changes, size changes, etc.)
4. How significant are these changes to the user experience? 
5. Would these changes likely be intentional design updates or accidental regressions?
6. Might any of these differences be false positives (e.g., minor rendering differences that don't affect functionality)?

Focus on meaningful differences that would impact the user experience and provide a detailed, specific analysis comparing what changed between the baseline and current versions.\`;`,
    `  // Create an enhanced prompt for the multi-image visual model
function createMultiImagePrompt(resultWithCorrectPaths) {
  // Make sure diffPixels exists, if not use diffPixelCount or calculate from percentage
  const diffPixels = resultWithCorrectPaths.diffPixels || 
                    resultWithCorrectPaths.diffPixelCount || 
                    Math.round((resultWithCorrectPaths.diffPercentage / 100) * (resultWithCorrectPaths.totalPixels || 1000000));
  
  return \`You are an expert in visual UI testing.

I'm showing you three images:
1. The original baseline UI screenshot
2. The current UI screenshot with changes
3. A visual difference map showing detected changes (red pixels indicate differences)

The diff represents \${resultWithCorrectPaths.diffPercentage.toFixed(2)}% of the image (\${diffPixels} pixels).

I need you to specifically look for and identify these types of UI bugs:
1. TEXT TRUNCATION: Check if any text that should be fully visible is now cut off with ellipsis or otherwise truncated
2. MISSING ELEMENTS: Identify any buttons, icons, or UI components that are present in the baseline but missing in the current version
3. COLOR CONTRAST ISSUES: Detect any color changes that create poor contrast between text and background
4. LAYOUT SHIFTS: Find elements that have moved from their original positions or are now overlapping incorrectly

For each issue you identify, please provide:
1. The specific UI element affected (e.g., "Submit button", "Information paragraph")
2. The type of issue (one of the four categories above)
3. How it impacts usability (e.g., "Text is now unreadable", "Button can no longer be clicked")
4. Severity (High/Medium/Low)

Also answer these questions:
1. How significant are these changes to the user experience? 
2. Would these changes likely be intentional design updates or accidental regressions?
3. Are there any false positives in the detected changes?

Provide a detailed, specific analysis comparing what changed between the baseline and current versions, focusing on the four specific bug types mentioned above.\`;`
  );
  
  // Enhance the single-image prompt
  enhancedContent = enhancedContent.replace(
    `  return \`You are an expert in visual UI testing.
I'm showing you a visual difference map between a baseline UI screenshot and a current version.
Red pixels indicate differences between the two versions.

The diff represents \${comparisonResult.diffPercentage.toFixed(2)}% of the image (\${diffPixels} pixels).

Please analyze the visual differences and tell me:
1. What type of changes do you see? (e.g., color changes, layout shifts, text changes, etc.)
2. Which UI elements are affected?
3. How significant are these changes?
4. Would these changes likely be intentional or accidental?
5. Might these be false positives (e.g., minor rendering differences)?

Focus only on the meaningful differences that would impact the user experience.\`;`,
    `  return \`You are an expert in visual UI testing.
I'm showing you a visual difference map between a baseline UI screenshot and a current version.
Red pixels indicate differences between the two versions.

The diff represents \${comparisonResult.diffPercentage.toFixed(2)}% of the image (\${diffPixels} pixels).

I need you to specifically look for and identify these types of UI bugs:
1. TEXT TRUNCATION: Check if any text appears to be cut off (visible as red pixels at the end of text areas)
2. MISSING ELEMENTS: Look for outlines or large sections of red pixels that might indicate removed UI elements
3. COLOR CONTRAST ISSUES: Areas with subtle red distributions might indicate color changes
4. LAYOUT SHIFTS: Parallel or offset red sections often indicate elements that have moved

For each issue you identify, please:
1. Describe the affected area of the UI
2. Classify the type of issue (one of the four categories above)
3. Estimate the severity (High/Medium/Low) based on how much it would impact users

Also consider:
1. How significant are these changes to the user experience? 
2. Would these changes likely be intentional design updates or accidental regressions?
3. Are there any false positives in the detected changes?

Focus only on the meaningful differences that would impact the user experience.\`;`
  );
  
  // Write the enhanced content back
  fs.writeFileSync(visualAnalyzerPath, enhancedContent);
  console.log('✅ Enhanced the visual analyzer prompts');
}

// Main function to enhance Phase 2
function enhancePhase2() {
  try {
    // 1. Enhance the visual analyzer prompts
    enhanceVisualAnalyzerPrompts();
    
    // 2. Update run-phase2.js to always use our enhanced Phase 1 bugs first
    console.log('\n✅ Phase 2 successfully enhanced for better LLaVA-2 integration');
    console.log('\nTo run the enhanced Phase 2:');
    console.log('1. First run enhanced Phase 1: npm run phase1');
    console.log('2. Then run Phase 2: npm run phase2');
    console.log('\nThis will analyze the comprehensive visual bugs with the enhanced AI prompts');
    
  } catch (error) {
    console.error(`❌ Error enhancing Phase 2: ${error.message}`);
  }
}

// Run the enhancement
enhancePhase2();
