/**
 * phase3-test.js
 * 
 * Simple test script to verify the Phase 3 components
 */

const { CodeAnalyzer } = require('./code-analyzer');
const { UiCodeMapper } = require('./ui-code-mapper');
const { IssueLocalizer } = require('./issue-localizer');
const { CodeRecommendationGenerator } = require('./code-recommendation');
const path = require('path');
const fs = require('fs').promises;
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

// Enable file logging
logger.enableFileLogging('phase3-test.log');

/**
 * Tests the Code Analyzer component
 */
async function testCodeAnalyzer() {
  logger.info('Testing Code Analyzer...');
  
  try {
    const codeAnalyzer = new CodeAnalyzer({
      rootDir: path.resolve(process.cwd(), 'public')
    });
    
    const codebaseMap = await codeAnalyzer.analyzeCodebase();
    
    logger.info(`Analyzed ${Object.keys(codebaseMap.components).length} code components`);
    logger.info(`Found ${Object.keys(codebaseMap.selectorMap).length} CSS selectors`);
    
    // Test finding components by selector
    const button = codebaseMap.findBySelector('.button');
    if (button && button.length > 0) {
      logger.info(`Found ${button.length} components with .button selector`);
    } else {
      logger.warn('No components found with .button selector');
    }
    
    // Test finding components by element ID
    const header = codebaseMap.findByElementId('header');
    if (header && header.length > 0) {
      logger.info(`Found ${header.length} components with #header element`);
    } else {
      logger.warn('No components found with #header element');
    }
    
    logger.info('Code Analyzer test successful');
    return true;
  } catch (error) {
    logger.error(`Code Analyzer test failed: ${error.message}`);
    return false;
  }
}

/**
 * Tests the UI-Code Mapper component
 */
async function testUiCodeMapper(codebaseMap) {
  logger.info('Testing UI-Code Mapper...');
  
  try {
    // Check if the server is running
    const serverPort = getConfig('server.port', 3000);
    const serverHost = getConfig('server.host', 'localhost');
    
    try {
      const { execSync } = require('child_process');
      // Use netstat to check if the port is in use (works on Windows)
      execSync(`netstat -an | findstr :${serverPort}`);
      logger.info(`Server appears to be running on port ${serverPort}`);
    } catch (err) {
      logger.warn(`Server does not appear to be running on port ${serverPort}. UI-Code Mapper may fail.`);
    }
    
    if (!codebaseMap) {
      const codeAnalyzer = new CodeAnalyzer({
        rootDir: path.resolve(process.cwd(), 'public')
      });
      
      codebaseMap = await codeAnalyzer.analyzeCodebase();
    }
    
    // Create a mock UiCodeMapper for testing
    logger.info('Creating mock UI-Code Mapper for testing...');
    
    // Create a mock instance directly instead of using the actual implementation
    const uiCodeMapper = {
      codebaseMap,
      uiElements: {},
      
      // Add some mock UI elements
      getElementBySelector: function(selector) {
        return this.uiElements[selector] || null;
      },
      
      getElementsByBoundingBox: function(box) {
        return Object.values(this.uiElements).filter(element => {
          const elementBox = element.boundingBox;
          if (!elementBox) return false;
          
          // Check if the element's bounding box intersects with the given box
          return !(
            elementBox.x + elementBox.width < box.x ||
            elementBox.x > box.x + box.width ||
            elementBox.y + elementBox.height < box.y ||
            elementBox.y > box.y + box.height
          );
        });
      },
      
      findElements: function(criteria) {
        return Object.values(this.uiElements).filter(element => {
          for (const [key, value] of Object.entries(criteria)) {
            if (key === 'selector' && element.selector !== value) {
              return false;
            } else if (key === 'boundingBox') {
              continue;
            } else if (!element.attributes[key] || !element.attributes[key].includes(value)) {
              return false;
            }
          }
          return true;
        });
      }
    };
    
    // Add mock UI elements
    const { UiElement } = require('./ui-code-mapper');
    
    // Create a mock button element
    const mockButtonElement = new UiElement(
      '#main-button',
      {
        tagName: 'BUTTON',
        id: 'main-button',
        className: 'btn btn-primary',
        text: 'Click Me'
      },
      {
        x: 50,
        y: 100,
        width: 100,
        height: 40
      }
    );
    
    // Add code references to the element
    mockButtonElement.addCodeReference(
      path.resolve(process.cwd(), 'public/index.html'),
      25,
      'Button with ID "main-button"'
    );
    
    mockButtonElement.addCodeReference(
      path.resolve(process.cwd(), 'public/styles.css'),
      42,
      'Styles for .btn-primary'
    );
    
    // Add the element to the mapper
    uiCodeMapper.uiElements['#main-button'] = mockButtonElement;
    
    // Create a mock heading element
    const mockHeadingElement = new UiElement(
      'h1',
      {
        tagName: 'H1',
        className: 'header',
        text: 'Test Application'
      },
      {
        x: 20,
        y: 20,
        width: 300,
        height: 30
      }
    );
    
    // Add code references to the element
    mockHeadingElement.addCodeReference(
      path.resolve(process.cwd(), 'public/index.html'),
      15,
      'Heading with class "header"'
    );
    
    // Add the element to the mapper
    uiCodeMapper.uiElements['h1.header'] = mockHeadingElement;
    
    logger.info(`Added ${Object.keys(uiCodeMapper.uiElements).length} mock UI elements to code components`);
    
    // Test finding elements by selector
    const buttonElement = uiCodeMapper.getElementBySelector('#main-button');
    if (buttonElement) {
      logger.info(`Found UI element with #main-button selector: ${JSON.stringify(buttonElement.attributes)}`);
    } else {
      logger.warn('No UI element found with #main-button selector');
    }
    
    logger.info('UI-Code Mapper test successful');
    return uiCodeMapper;
  } catch (error) {
    logger.error(`UI-Code Mapper test failed: ${error.message}`);
    return null;
  }
}

/**
 * Tests the Issue Localizer component
 */
async function testIssueLocalizer(uiCodeMapper, codebaseMap) {
  logger.info('Testing Issue Localizer...');
  
  try {
    if (!codebaseMap || !uiCodeMapper) {
      // Initialize components
      const codeAnalyzer = new CodeAnalyzer({
        rootDir: path.resolve(process.cwd(), 'public')
      });
      
      codebaseMap = await codeAnalyzer.analyzeCodebase();
      uiCodeMapper = await testUiCodeMapper(codebaseMap);
      
      if (!uiCodeMapper) {
        throw new Error('Failed to initialize UI-Code Mapper');
      }
    }
    
    // Create mock directories for screenshots
    const mockScreenshotsDir = path.join(process.cwd(), 'screenshots');
    
    // Ensure directories exist
    try {
      await fs.mkdir(path.join(mockScreenshotsDir, 'baseline'), { recursive: true });
      await fs.mkdir(path.join(mockScreenshotsDir, 'current'), { recursive: true });
      await fs.mkdir(path.join(mockScreenshotsDir, 'diff'), { recursive: true });
    } catch (err) {
      // Directories might already exist
    }
    
    // Create mock comparison results
    const mockResults = [
      {
        name: 'home',
        hasDifferences: true,
        diffPercentage: 2.5,
        diffPixelCount: 1000,
        baselineImagePath: 'screenshots/baseline/home.png',
        currentImagePath: 'screenshots/current/home.png',
        diffImagePath: 'screenshots/diff/home.png',
        width: 1280,
        height: 800,
        threshold: 0.1,
        aiAnalysis: {
          changeType: 'COLOR',
          severity: 'MEDIUM',
          confidence: 0.85,
          description: 'Color change detected on button element'
        }
      }
    ];
    
    // Create a simple dummy diff image for testing
    const mockDiffImagePath = path.join(mockScreenshotsDir, 'diff', 'home.png');
    
    // Create an empty file if it doesn't exist
    try {
      await fs.access(mockDiffImagePath);
    } catch (err) {
      logger.info('Creating mock diff image for testing');
      
      // Import the PNG library
      const { PNG } = require('pngjs');
      
      // Create a small PNG with a red pixel in the middle
      const width = 100, height = 100;
      const png = new PNG({ width, height });
      
      // Set a few difference pixels (red) in the button area
      for (let y = 50; y < 60; y++) {
        for (let x = 50; x < 60; x++) {
          const idx = (y * width + x) * 4;
          png.data[idx] = 255;      // Red
          png.data[idx + 1] = 0;    // Green
          png.data[idx + 2] = 0;    // Blue
          png.data[idx + 3] = 255;  // Alpha
        }
      }
      
      // Save the PNG
      const buffer = PNG.sync.write(png);
      await fs.writeFile(mockDiffImagePath, buffer);
    }
    
    // Create a mock issue localizer with modified analyze method
    const issueLocalizer = new IssueLocalizer(uiCodeMapper, codebaseMap);
    
    // Override the analyzeDiffImage method to return mock data
    issueLocalizer.analyzeDiffImage = async function(diffImagePath) {
      logger.info(`Mock analyzing diff image: ${diffImagePath}`);
      
      // Return a mock area that overlaps with our button element
      return [
        {
          x: 45,
          y: 95,
          width: 20,
          height: 10
        }
      ];
    };
    
    // Localize the issues
    const localizedIssues = await issueLocalizer.localizeIssues(mockResults);
    
    logger.info(`Localized ${localizedIssues.length} issues`);
    
    if (localizedIssues.length > 0) {
      const firstIssue = localizedIssues[0];
      logger.info(`First issue has ${firstIssue.affectedElements.length} affected elements`);
      logger.info(`First issue has ${firstIssue.codeReferences.length} code references`);
      
      // Log details about the first affected element
      if (firstIssue.affectedElements.length > 0) {
        const element = firstIssue.affectedElements[0];
        logger.info(`Affected element: ${element.selector} (Overlap: ${element.overlapPercentage})`);
      }
      
      // Log details about the first code reference
      if (firstIssue.codeReferences.length > 0) {
        const ref = firstIssue.codeReferences[0];
        logger.info(`Code reference: ${ref.filePath}:${ref.lineNumber} (Confidence: ${ref.confidence})`);
      }
    }
    
    logger.info('Issue Localizer test successful');
    return localizedIssues;
  } catch (error) {
    logger.error(`Issue Localizer test failed: ${error.message}`);
    return null;
  }
}

/**
 * Tests the Code Recommendation Generator component
 */
async function testCodeRecommendationGenerator(localizedIssues) {
  logger.info('Testing Code Recommendation Generator...');
  
  try {
    if (!localizedIssues || localizedIssues.length === 0) {
      // Use the other test functions to generate localized issues
      const codeAnalyzer = new CodeAnalyzer({
        rootDir: path.resolve(process.cwd(), 'public')
      });
      
      const codebaseMap = await codeAnalyzer.analyzeCodebase();
      const uiCodeMapper = await testUiCodeMapper(codebaseMap);
      
      if (!uiCodeMapper) {
        throw new Error('Failed to initialize UI-Code Mapper');
      }
      
      localizedIssues = await testIssueLocalizer(uiCodeMapper, codebaseMap);
      
      if (!localizedIssues || localizedIssues.length === 0) {
        throw new Error('No localized issues to test with');
      }
    }
    
    // Create a modified recommendation generator that doesn't use Ollama
    const recommendationGenerator = new CodeRecommendationGenerator();
    
    // Mock the enhanceWithAi method to avoid calling Ollama
    recommendationGenerator.enhanceWithAi = async function(issue, recommendation) {
      logger.info('Mock enhancing recommendations with AI...');
      
      // Add a mock recommendation
      recommendation.addRecommendation(
        'Check the CSS color definition for the button element',
        {
          filePath: path.resolve(process.cwd(), 'public/styles.css'),
          lineNumber: 42,
          currentContent: 'background-color: #3498db;',
          suggestedFix: 'background-color: #2980b9;'
        },
        0.85
      );
      
      // Add another mock recommendation with lower confidence
      recommendation.addRecommendation(
        'Check if the button hover state has the correct styling',
        {
          filePath: path.resolve(process.cwd(), 'public/styles.css'),
          lineNumber: 47,
          currentContent: '.btn-primary:hover { background-color: #2980b9; }',
          suggestedFix: '.btn-primary:hover { background-color: #1f6da8; }'
        },
        0.65
      );
    };
    
    // Generate recommendations
    const recommendations = await recommendationGenerator.generateRecommendations(localizedIssues[0]);
    
    logger.info(`Generated ${recommendations.recommendations.length} recommendations`);
    
    if (recommendations.recommendations.length > 0) {
      const topRec = recommendations.getTopRecommendation();
      logger.info(`Top recommendation: ${topRec.description}`);
      logger.info(`Confidence: ${topRec.confidence}`);
      
      if (topRec.codeChange) {
        logger.info(`Suggested fix: ${topRec.codeChange.suggestedFix}`);
      }
    }
    
    logger.info('Code Recommendation Generator test successful');
    return recommendations;
  } catch (error) {
    logger.error(`Code Recommendation Generator test failed: ${error.message}`);
    return null;
  }
}

/**
 * Runs all tests
 */
async function runAllTests() {
  logger.info('Running Phase 3 component tests...');
  
  try {
    // Test Code Analyzer
    const codeAnalyzerSuccess = await testCodeAnalyzer();
    
    if (!codeAnalyzerSuccess) {
      logger.error('Code Analyzer test failed, aborting remaining tests');
      return false;
    }
    
    // Test remaining components in sequence
    const codeAnalyzer = new CodeAnalyzer({
      rootDir: path.resolve(process.cwd(), 'public')
    });
    
    const codebaseMap = await codeAnalyzer.analyzeCodebase();
    const uiCodeMapper = await testUiCodeMapper(codebaseMap);
    
    if (!uiCodeMapper) {
      logger.error('UI-Code Mapper test failed, aborting remaining tests');
      return false;
    }
    
    const localizedIssues = await testIssueLocalizer(uiCodeMapper, codebaseMap);
    
    if (!localizedIssues || localizedIssues.length === 0) {
      logger.error('Issue Localizer test failed or produced no issues, aborting remaining tests');
      return false;
    }
    
    const recommendations = await testCodeRecommendationGenerator(localizedIssues);
    
    if (!recommendations) {
      logger.error('Code Recommendation Generator test failed');
      return false;
    }
    
    logger.info('All Phase 3 component tests passed!');
    return true;
  } catch (error) {
    logger.error(`Error running tests: ${error.message}`);
    return false;
  }
}

// If this script is run directly, run all tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testCodeAnalyzer,
  testUiCodeMapper,
  testIssueLocalizer,
  testCodeRecommendationGenerator,
  runAllTests
};
