/**
 * Phase 2 Runner (Enhanced)
 * 
 * This script serves as a simplified entry point for running Phase 2 (AI-Enhanced Visual Testing)
 * It now includes enhanced AI prompts for better LLaVA-2 integration by default.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);

// Skip enhancement if specifically requested
const skipEnhancement = args.includes('--skip-enhancement');

// Add path to workflow file
const workflowPath = path.join(__dirname, 'src', 'phase2', 'ai-workflow.js');
const visualAnalyzerPath = path.join(__dirname, 'src', 'phase2', 'visual-analyzer.js');

console.log(`Running Phase 2: AI-Enhanced Visual Testing`);
console.log('-'.repeat(40));

// Enhance the visual analyzer prompts if not skipped
if (!skipEnhancement) {
  try {
    enhanceVisualAnalyzerPrompts();
  } catch (error) {
    console.error(`Warning: Could not enhance prompts: ${error.message}`);
    console.log('Continuing with standard prompts...');
  }
}

// Check if Ollama is running first
checkOllamaAvailability()
  .then(isAvailable => {
    if (!isAvailable && !args.includes('--skip-ai')) {
      console.warn('\n⚠️ Ollama is not available. Adding --skip-ai flag.');
      args.push('--skip-ai');
    }

    // Spawn the Phase 2 workflow process
    const childProcess = spawn('node', [workflowPath, ...args], {
      stdio: 'inherit',
      shell: true
    });

    // Handle process exit
    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Phase 2 completed successfully!');
        console.log('Reports are available in the reports directory.');
      } else {
        console.error(`\n❌ Phase 2 failed with code ${code}`);
      }
      process.exit(code);
    });

    // Handle errors
    childProcess.on('error', (err) => {
      console.error(`❌ Failed to start Phase 2 workflow: ${err.message}`);
      process.exit(1);
    });
  })
  .catch(error => {
    console.error('❌ Error checking Ollama availability:', error.message);
    console.log('Proceeding with --skip-ai flag...');
    args.push('--skip-ai');
    
    // Spawn the Phase 2 workflow process with skip-ai flag
    const childProcess = spawn('node', [workflowPath, ...args], {
      stdio: 'inherit',
      shell: true
    });

    // Handle process exit
    childProcess.on('close', (code) => {
      process.exit(code);
    });
  });

/**
 * Enhances the visual analyzer prompts to better detect specific bug types
 */
function enhanceVisualAnalyzerPrompts() {
  console.log('Enhancing visual analyzer prompts for better LLaVA-2 integration...');
  
  // Read the visual analyzer file
  const visualAnalyzerContent = fs.readFileSync(visualAnalyzerPath, 'utf8');
  
  // Check if it's already enhanced
  if (visualAnalyzerContent.includes('TEXT TRUNCATION: Check if any text')) {
    console.log('✅ Visual analyzer already enhanced');
    return;
  }
  
  // Enhance multi-image prompt
  let enhancedContent = visualAnalyzerContent;
  
  // Look for the multi-image prompt function
  const multiImagePromptRegex = /function createMultiImagePrompt\([^)]*\)\s*{[^}]*return\s*`[\s\S]*?`;/;
  if (multiImagePromptRegex.test(visualAnalyzerContent)) {
    enhancedContent = visualAnalyzerContent.replace(
      multiImagePromptRegex,
      `function createMultiImagePrompt(resultWithCorrectPaths) {
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
  } else {
    console.warn('⚠️ Could not find multi-image prompt function to enhance');
  }
  
  // Look for the single-image prompt function
  const singleImagePromptRegex = /function createVisualPrompt\([^)]*\)\s*{[^}]*return\s*`[\s\S]*?`;/;
  if (singleImagePromptRegex.test(enhancedContent)) {
    enhancedContent = enhancedContent.replace(
      singleImagePromptRegex,
      `function createVisualPrompt(comparisonResult) {
  // Make sure diffPixels exists, if not use diffPixelCount or calculate from percentage
  const diffPixels = comparisonResult.diffPixels || 
                    comparisonResult.diffPixelCount || 
                    Math.round((comparisonResult.diffPercentage / 100) * (comparisonResult.totalPixels || 1000000));
  
  return \`You are an expert in visual UI testing.
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
  } else {
    console.warn('⚠️ Could not find single-image prompt function to enhance');
  }
  
  // Write the enhanced content back if changes were made
  if (enhancedContent !== visualAnalyzerContent) {
    fs.writeFileSync(visualAnalyzerPath, enhancedContent);
    console.log('✅ Enhanced the visual analyzer prompts');
  } else {
    console.warn('⚠️ No changes made to the visual analyzer');
  }
}

// Check if Ollama is running
function checkOllamaAvailability() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            console.log('✅ Ollama is running');
            resolve(true);
          } else {
            console.warn('⚠️ Ollama returned unexpected status:', res.statusCode);
            resolve(false);
          }
        } catch (error) {
          console.warn('⚠️ Error parsing Ollama response:', error.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      console.warn('⚠️ Ollama is not running');
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.warn('⚠️ Connection to Ollama timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}
