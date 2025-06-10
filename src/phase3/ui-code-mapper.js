/**
 * ui-code-mapper.js
 * 
 * Maps UI elements from visual screenshots to their corresponding code components.
 * This establishes the connection between the visual elements and the code that renders them.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const { getConfig } = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Represents a UI element with its attributes and code mapping
 */
class UiElement {
  constructor(selector, attributes = {}, boundingBox = null) {
    this.selector = selector;
    this.attributes = attributes;
    this.boundingBox = boundingBox;
    this.codeReferences = []; // References to code files and lines
  }

  /**
   * Add a code reference to this UI element
   * 
   * @param {string} filePath - Path to the code file
   * @param {number} lineNumber - Line number in the file
   * @param {string} context - Additional context about the reference
   */
  addCodeReference(filePath, lineNumber, context = '') {
    this.codeReferences.push({
      filePath,
      lineNumber,
      context
    });
  }
}

/**
 * Maps UI elements to code components
 */
class UiCodeMapper {
  /**
   * Creates a new UI-Code mapper
   * 
   * @param {Object} codebaseMap - The codebase map from CodeAnalyzer
   * @param {Object} options - Mapper options
   */
  constructor(codebaseMap, options = {}) {
    this.codebaseMap = codebaseMap;
    this.uiElements = {};
    this.options = {
      url: `http://${getConfig('server.host', 'localhost')}:${getConfig('server.port', 3000)}`,
      viewport: {
        width: getConfig('screenshots.viewportWidth', 1280),
        height: getConfig('screenshots.viewportHeight', 800)
      },
      ...options
    };
  }

  /**
   * Extract UI elements from the page and map them to code components
   * 
   * @returns {Promise<Object>} Mapping of UI elements to code components
   */
  async mapUiElementsToCode() {
    logger.info('Mapping UI elements to code components...');
    
    let browser = null;
    let maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        });({ headless: 'new' });
        
        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport(this.options.viewport);
        
        // Navigate to the URL with a longer timeout
        logger.info(`Connecting to ${this.options.url} (attempt ${retryCount + 1}/${maxRetries})...`);
        await page.goto(this.options.url, { 
          waitUntil: 'networkidle2', // Change to networkidle2 which is less strict
          timeout: 90000 // Increase timeout to 90 seconds
        });
        
        // Extract UI elements from the page
        const elements = await this.extractUiElements(page);
        
        // Map the elements to code components
        await this.mapElementsToCode(elements);
        
        logger.info(`Mapped ${Object.keys(this.uiElements).length} UI elements to code components`);
        
        await browser.close();
        return this.uiElements;
      } catch (error) {
        logger.error(`Error mapping UI elements to code (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`);
        
        if (browser) {
          try {
            await browser.close();
          } catch (err) {
            logger.error(`Error closing browser: ${err.message}`);
          }
        }
        
        retryCount++;
        
        if (retryCount >= maxRetries) {
          logger.error(`Failed to map UI elements after ${maxRetries} attempts`);
          throw error;
        }
        
        // Wait before retrying
        logger.info(`Waiting 5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Extract UI elements from the page
   * 
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<Array>} Array of extracted UI elements
   */
  async extractUiElements(page) {
    logger.info('Extracting UI elements from page...');
    
    // Extract elements with IDs
    const elementsWithIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[id]')).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          selector: `#${el.id}`,
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          text: el.innerText,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      });
    });
    
    // Extract elements with classes
    const elementsWithClasses = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[class]')).map(el => {
        if (el.id) return null; // Skip elements with IDs (already captured)
        
        const rect = el.getBoundingClientRect();
        return {
          selector: el.className.split(' ').map(c => `.${c}`).join(''),
          tagName: el.tagName,
          className: el.className,
          text: el.innerText,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      }).filter(Boolean);
    });
    
    // Extract elements with data-test attributes
    const elementsWithDataTest = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-test]')).map(el => {
        if (el.id) return null; // Skip elements with IDs (already captured)
        
        const rect = el.getBoundingClientRect();
        return {
          selector: `[data-test="${el.getAttribute('data-test')}"]`,
          tagName: el.tagName,
          dataTest: el.getAttribute('data-test'),
          className: el.className,
          text: el.innerText,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      }).filter(Boolean);
    });
    
    // Combine all elements
    const allElements = [
      ...elementsWithIds,
      ...elementsWithClasses,
      ...elementsWithDataTest
    ];
    
    logger.info(`Extracted ${allElements.length} UI elements from page`);
    
    return allElements;
  }

  /**
   * Map extracted UI elements to code components
   * 
   * @param {Array} elements - Array of extracted UI elements
   */
  async mapElementsToCode(elements) {
    logger.info('Mapping elements to code components...');
    
    elements.forEach(element => {
      const uiElement = new UiElement(
        element.selector,
        {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          dataTest: element.dataTest,
          text: element.text
        },
        element.boundingBox
      );
      
      // Map element to code components
      if (element.id) {
        // Find code components with this ID
        const componentsWithId = this.codebaseMap.findByElementId(element.id);
        
        componentsWithId.forEach(component => {
          const matches = component.findPattern(new RegExp(`id=["']${element.id}["']`));
          matches.forEach(match => {
            uiElement.addCodeReference(
              component.filePath,
              match.line,
              `Element with ID "${element.id}"`
            );
          });
        });
      }
      
      if (element.className) {
        // Find code components with these classes
        const classes = element.className.split(/\s+/).filter(Boolean);
        
        classes.forEach(className => {
          const componentsWithClass = this.codebaseMap.findByClassName(className);
          
          componentsWithClass.forEach(component => {
            const matches = component.findPattern(new RegExp(`class=["'][^"']*${className}[^"']*["']`));
            matches.forEach(match => {
              uiElement.addCodeReference(
                component.filePath,
                match.line,
                `Element with class "${className}"`
              );
            });
          });
        });
      }
      
      // Add to uiElements map using the selector as key
      this.uiElements[element.selector] = uiElement;
    });
  }

  /**
   * Get a UI element by selector
   * 
   * @param {string} selector - The selector for the UI element
   * @returns {UiElement|null} The UI element or null if not found
   */
  getElementBySelector(selector) {
    return this.uiElements[selector] || null;
  }

  /**
   * Get UI elements by bounding box coordinates
   * 
   * @param {Object} box - The bounding box coordinates
   * @returns {Array} Array of UI elements in the bounding box
   */
  getElementsByBoundingBox(box) {
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
  }

  /**
   * Find UI elements that match given criteria
   * 
   * @param {Object} criteria - Criteria to match
   * @returns {Array} Array of matching UI elements
   */
  findElements(criteria) {
    return Object.values(this.uiElements).filter(element => {
      for (const [key, value] of Object.entries(criteria)) {
        if (key === 'selector' && element.selector !== value) {
          return false;
        } else if (key === 'boundingBox') {
          // Skip bounding box check, handled by getElementsByBoundingBox
          continue;
        } else if (!element.attributes[key] || !element.attributes[key].includes(value)) {
          return false;
        }
      }
      return true;
    });
  }
}

module.exports = {
  UiCodeMapper,
  UiElement
};
