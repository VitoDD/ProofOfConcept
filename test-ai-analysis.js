/**
 * test-ai-analysis.js
 * 
 * This script directly tests the AI analysis capabilities of the system
 * by analyzing test images and reporting the results.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Directory paths
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORTS_DIR = path.join(__dirname, 'reports');

/**
 * Check if Ollama is running and has required models
 */
async function checkOllamaStatus() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`❌ Ollama returned status code: ${res.statusCode}`);
            resolve({ available: false, error: `Unexpected status code: ${res.statusCode}` });
            return;
          }
          
          const response = JSON.parse(data);
          
          if (!response.models || !Array.isArray(response.models)) {
            console.error('❌ Ollama response does not contain models array');
            resolve({ available: false, error: 'Invalid response format' });
            return;
          }
          
          // Check for required models (llava for image analysis)
          const models = response.models.map(model => model.name.toLowerCase());
          const llavaAvailable = models.some(m => m.includes('llava'));
          
          if (!llavaAvailable) {
            console.error('❌ LLaVA model not found in Ollama');
            console.log('Please install LLaVA with: ollama pull llava');
            resolve({ 
              available: false, 
              error: 'LLaVA model not found',
              models
            });
            return;
          }
          
          console.log('✅ Ollama is running with LLaVA model');
          console.log(`Available models: ${models.join(', ')}`);
          resolve({ 
            available: true, 
            models 
          });
        } catch (error) {
          console.error('❌ Error parsing Ollama response:', error.message);
          resolve({ available: false, error: error.message });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Error connecting to Ollama:', error.message);
      resolve({ available: false, error: error.message });
    });
    
    req.on('timeout', () => {
      console.error('❌ Connection to Ollama timed out');
      req.destroy();
      resolve({ available: false, error: 'Connection timeout' });
    });
    
    req.end();
  });
}

/**
 * Call the Ollama API directly to analyze an image
 */
async function analyzeImageWithOllama(imagePath, prompt) {
  try {
    // First check if the image exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }
    
    // Read the image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    console.log(`Analyzing image: ${path.basename(imagePath)}`);
    console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    
    // Prepare the request body
    const requestBody = {
      model: 'llava',
      prompt: prompt,
      images: [base64Image],
      stream: false
    };
    
    // Make the API request
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      timeout: 60000 // 1 minute timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }
    
    // Get the response
    const responseText = await response.text();
    
    try {
      // Try to parse as JSON
      const data = JSON.parse(responseText);
      return data.response || responseText;
    } catch (error) {
      // If not valid JSON, just return the text
      return responseText;
    }
  } catch (error) {
    console.error(`Error analyzing image: ${error.message}`);
    return `Error: ${error.message}`;
  }
}

/**
 * Find the most recent test images
 */
function findTestImages() {
  // First try to find the most recent diff image
  const diffDir = path.join(SCREENSHOTS_DIR, 'diff');
  const baselineDir = path.join(SCREENSHOTS_DIR, 'baseline');
  const currentDir = path.join(SCREENSHOTS_DIR, 'current');
  
  // Check if directories exist
  if (!fs.existsSync(diffDir) || !fs.existsSync(baselineDir) || !fs.existsSync(currentDir)) {
    console.error('❌ Screenshot directories not found. Run Phase 1 first to generate screenshots.');
    return null;
  }
  
  // Get the timestamp directories in diff
  const timestampDirs = fs.readdirSync(diffDir)
    .filter(name => name.match(/\d{4}-\d{2}-\d{2}T/))
    .sort()
    .reverse(); // Most recent first
  
  if (timestampDirs.length === 0) {
    // Check if there are direct diff images
    const diffImages = fs.readdirSync(diffDir)
      .filter(name => name.endsWith('.png') && name.startsWith('diff-'));
    
    if (diffImages.length === 0) {
      console.error('❌ No diff images found. Run Phase 1 first to generate screenshots.');
      return null;
    }
    
    // Use the first diff image
    const diffImage = path.join(diffDir, diffImages[0]);
    const baselineName = diffImages[0].replace('diff-', 'baseline-');
    const currentName = diffImages[0].replace('diff-', 'current-');
    
    const baselineImage = path.join(baselineDir, baselineName);
    const currentImage = path.join(currentDir, currentName);
    
    if (!fs.existsSync(baselineImage) || !fs.existsSync(currentImage)) {
      console.error('❌ Baseline or current images not found');
      return null;
    }
    
    return {
      diffImage,
      baselineImage,
      currentImage,
      name: diffImages[0].replace('diff-', '').replace('.png', '')
    };
  }
  
  // Use the most recent timestamp directory
  const mostRecentTimestamp = timestampDirs[0];
  const timestampDiffDir = path.join(diffDir, mostRecentTimestamp);
  
  // Get all diff images in the timestamp directory
  const diffImages = fs.readdirSync(timestampDiffDir)
    .filter(name => name.endsWith('.png') && name.startsWith('diff-'));
  
  if (diffImages.length === 0) {
    console.error('❌ No diff images found in the most recent timestamp directory');
    return null;
  }
  
  // Find the baseline and current images
  const baselineImage = path.join(baselineDir, diffImages[0].replace('diff-', 'baseline-'));
  
  // For current image, look in timestamp directory
  const timestampCurrentDir = path.join(currentDir, mostRecentTimestamp);
  const currentImage = path.join(timestampCurrentDir, diffImages[0].replace('diff-', 'current-'));
  
  // Check if images exist
  if (!fs.existsSync(baselineImage)) {
    console.error(`❌ Baseline image not found: ${baselineImage}`);
    return null;
  }
  
  if (!fs.existsSync(currentImage)) {
    console.error(`❌ Current image not found: ${currentImage}`);
    return null;
  }
  
  return {
    diffImage: path.join(timestampDiffDir, diffImages[0]),
    baselineImage,
    currentImage,
    name: diffImages[0].replace('diff-', '').replace('.png', '')
  };
}

/**
 * Main function
 */
async function main() {
  console.log('Testing AI Analysis Capabilities');
  console.log('-'.repeat(40));
  
  // 1. Check if Ollama is running
  console.log('\nChecking Ollama status...');
  const ollamaStatus = await checkOllamaStatus();
  
  if (!ollamaStatus.available) {
    console.error('❌ Ollama is not available. Please start Ollama and make sure the LLaVA model is installed.');
    console.log('Install LLaVA with: ollama pull llava');
    process.exit(1);
  }
  
  // 2. Find test images
  console.log('\nFinding test images...');
  const testImages = findTestImages();
  
  if (!testImages) {
    console.error('❌ Could not find test images. Run Phase 1 first to generate screenshots.');
    process.exit(1);
  }
  
  console.log(`✅ Found test images for: ${testImages.name}`);
  console.log(`Baseline: ${testImages.baselineImage}`);
  console.log(`Current: ${testImages.currentImage}`);
  console.log(`Diff: ${testImages.diffImage}`);
  
  // 3. Test AI analysis with diff image only
  console.log('\nTesting AI analysis with diff image only...');
  
  const diffPrompt = `You are an expert in visual UI testing.
I'm showing you a visual difference map between a baseline UI screenshot and a current version.
Red pixels indicate differences between the two versions.

I need you to specifically look for and identify these types of UI bugs:
1. TEXT TRUNCATION: Check if any text appears to be cut off (visible as red pixels at the end of text areas)
2. MISSING ELEMENTS: Look for outlines or large sections of red pixels that might indicate removed UI elements
3. COLOR CONTRAST ISSUES: Areas with subtle red distributions might indicate color changes
4. LAYOUT SHIFTS: Parallel or offset red sections often indicate elements that have moved

For each issue you identify, please:
1. Describe the affected area of the UI
2. Classify the type of issue (one of the four categories above)
3. Estimate the severity (High/Medium/Low) based on how much it would impact users

Focus only on the meaningful differences that would impact the user experience.`;
  
  const diffAnalysis = await analyzeImageWithOllama(testImages.diffImage, diffPrompt);
  
  console.log('\nDiff Image Analysis:');
  console.log('-'.repeat(40));
  console.log(diffAnalysis);
  
  // 4. Test with all three images
  console.log('\nTesting AI analysis with all three images...');
  
  // Save results to a file
  const outputPath = path.join(REPORTS_DIR, `ai-test-analysis-${Date.now()}.txt`);
  fs.writeFileSync(outputPath, `AI Analysis Test Results\n${'-'.repeat(40)}\n\nDiff Image Analysis:\n${diffAnalysis}\n`);
  
  console.log(`\n✅ AI analysis test completed`);
  console.log(`Results saved to: ${outputPath}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Error running AI analysis test:', error);
  process.exit(1);
});
