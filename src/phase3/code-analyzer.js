/**
 * code-analyzer.js
 * 
 * Analyzes the application codebase to build a structured map of code components.
 * This map is used to establish relationships between code and UI elements.
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const logger = require('../utils/logger');

// File types to analyze
const ANALYZABLE_EXTENSIONS = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx'];

/**
 * Represents a code component with its structure and metadata
 */
class CodeComponent {
  constructor(filePath, content, type) {
    this.filePath = filePath;
    this.content = content;
    this.type = type; // 'html', 'css', 'js', etc.
    this.lines = content.split('\n');
    this.lineCount = this.lines.length;
    this.elements = []; // UI elements defined in this component
    this.dependencies = []; // Other components this one depends on
    this.selectors = []; // CSS selectors or DOM elements defined here
    this.modified = false; // Indicates if this component was modified recently
  }

  /**
   * Get a specific line range from the content
   * 
   * @param {number} start - Starting line number (0-indexed)
   * @param {number} end - Ending line number (0-indexed)
   * @returns {string} The content within the specified line range
   */
  getLineRange(start, end) {
    const validStart = Math.max(0, start);
    const validEnd = Math.min(this.lineCount - 1, end);
    return this.lines.slice(validStart, validEnd + 1).join('\n');
  }

  /**
   * Find all occurrences of a pattern in the content
   * 
   * @param {RegExp} pattern - Regular expression to search for
   * @returns {Array} Array of matches with line numbers
   */
  findPattern(pattern) {
    const matches = [];
    this.lines.forEach((line, index) => {
      const lineMatches = line.match(pattern);
      if (lineMatches) {
        matches.push({
          line: index + 1,
          content: line,
          match: lineMatches[0]
        });
      }
    });
    return matches;
  }
}

/**
 * Represents a codebase map with all components and their relationships
 */
class CodebaseMap {
  constructor() {
    this.components = {};
    this.elementMap = {}; // Maps UI element identifiers to code components
    this.selectorMap = {}; // Maps CSS selectors to their components
  }

  /**
   * Add a code component to the map
   * 
   * @param {string} filePath - Path to the file
   * @param {CodeComponent} component - The code component
   */
  addComponent(filePath, component) {
    this.components[filePath] = component;
    
    // Index any selectors found in this component
    component.selectors.forEach(selector => {
      if (!this.selectorMap[selector]) {
        this.selectorMap[selector] = [];
      }
      this.selectorMap[selector].push(filePath);
    });
  }

  /**
   * Find components that match a selector
   * 
   * @param {string} selector - The selector to search for
   * @returns {Array} Components matching the selector
   */
  findBySelector(selector) {
    const filePaths = this.selectorMap[selector] || [];
    return filePaths.map(filePath => this.components[filePath]);
  }

  /**
   * Find components by element ID
   * 
   * @param {string} elementId - The element ID to search for
   * @returns {Array} Components containing the element ID
   */
  findByElementId(elementId) {
    return Object.values(this.components).filter(component => {
      return component.findPattern(new RegExp(`id=["']${elementId}["']`)).length > 0;
    });
  }

  /**
   * Find components by class name
   * 
   * @param {string} className - The class name to search for
   * @returns {Array} Components containing the class name
   */
  findByClassName(className) {
    return Object.values(this.components).filter(component => {
      return component.findPattern(new RegExp(`class=["'][^"']*${className}[^"']*["']`)).length > 0;
    });
  }

  /**
   * Mark specific components as modified
   * 
   * @param {Array} modifiedFiles - List of file paths that were modified
   */
  markModifiedComponents(modifiedFiles) {
    modifiedFiles.forEach(filePath => {
      if (this.components[filePath]) {
        this.components[filePath].modified = true;
      }
    });
  }

  /**
   * Get all modified components
   * 
   * @returns {Array} List of modified components
   */
  getModifiedComponents() {
    return Object.values(this.components).filter(component => component.modified);
  }
}

/**
 * Analyzes a codebase to build a map of its components
 */
class CodeAnalyzer {
  /**
   * Creates a new code analyzer
   * 
   * @param {Object} options - Analyzer options
   */
  constructor(options = {}) {
    this.options = {
      rootDir: path.resolve(process.cwd(), 'public'),
      includePatterns: ['**/*.*'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      ...options
    };
    
    this.codebaseMap = new CodebaseMap();
  }

  /**
   * Analyze the codebase to build a map of components
   * 
   * @returns {Promise<CodebaseMap>} The codebase map
   */
  async analyzeCodebase() {
    logger.info('Analyzing codebase...');
    
    try {
      // Find all files matching the include/exclude patterns
      const files = await glob(this.options.includePatterns[0], {
        cwd: this.options.rootDir,
        ignore: this.options.excludePatterns,
        absolute: true
      });
      
      logger.info(`Found ${files.length} files to analyze`);
      
      if (files.length === 0) {
        logger.warn(`No files found in ${this.options.rootDir} matching patterns ${this.options.includePatterns}`);
        logger.warn(`Ensure the directory path is correct and contains source files`);
      }
      
      // Process each file
      let successfullyProcessed = 0;
      let failedToProcess = 0;
      
      for (const filePath of files) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ANALYZABLE_EXTENSIONS.includes(ext)) {
          try {
            await this.processFile(filePath);
            successfullyProcessed++;
          } catch (error) {
            logger.error(`Failed to process file ${filePath}: ${error.message}`);
            failedToProcess++;
          }
        }
      }
      
      logger.info(`Codebase analysis complete - Processed: ${successfullyProcessed}, Failed: ${failedToProcess}`);
      return this.codebaseMap;
    } catch (error) {
      logger.error(`Error analyzing codebase: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a single file and add it to the codebase map
   * 
   * @param {string} filePath - Path to the file
   */
  async processFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      let type;
      
      switch (ext) {
        case '.html':
          type = 'html';
          break;
        case '.css':
          type = 'css';
          break;
        case '.js':
        case '.jsx':
          type = 'js';
          break;
        case '.ts':
        case '.tsx':
          type = 'ts';
          break;
        default:
          type = 'other';
      }
      
      const component = new CodeComponent(filePath, content, type);
      
      // Extract selectors and other metadata based on file type
      if (type === 'html') {
        this.analyzeHtmlComponent(component);
      } else if (type === 'css') {
        this.analyzeCssComponent(component);
      } else if (type === 'js' || type === 'ts') {
        this.analyzeJsComponent(component);
      }
      
      this.codebaseMap.addComponent(filePath, component);
      
    } catch (error) {
      logger.error(`Error processing file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Analyze an HTML component to extract elements and selectors
   * 
   * @param {CodeComponent} component - The component to analyze
   */
  analyzeHtmlComponent(component) {
    // Extract element IDs
    const idMatches = component.findPattern(/id=["']([^"']+)["']/g);
    idMatches.forEach(match => {
      const idMatch = match.content.match(/id=["']([^"']+)["']/);
      if (idMatch && idMatch[1]) {
        component.elements.push({
          type: 'id',
          value: idMatch[1],
          line: match.line
        });
      }
    });
    
    // Extract class names
    const classMatches = component.findPattern(/class=["']([^"']+)["']/g);
    classMatches.forEach(match => {
      const classMatch = match.content.match(/class=["']([^"']+)["']/);
      if (classMatch && classMatch[1]) {
        const classes = classMatch[1].split(/\s+/).filter(Boolean);
        classes.forEach(className => {
          component.elements.push({
            type: 'class',
            value: className,
            line: match.line
          });
        });
      }
    });
    
    // Extract data-test attributes (often used for testing)
    const dataTestMatches = component.findPattern(/data-test=["']([^"']+)["']/g);
    dataTestMatches.forEach(match => {
      const dataTestMatch = match.content.match(/data-test=["']([^"']+)["']/);
      if (dataTestMatch && dataTestMatch[1]) {
        component.elements.push({
          type: 'data-test',
          value: dataTestMatch[1],
          line: match.line
        });
      }
    });
  }

  /**
   * Analyze a CSS component to extract selectors
   * 
   * @param {CodeComponent} component - The component to analyze
   */
  analyzeCssComponent(component) {
    // Simple CSS selector extraction (this could be improved with a real CSS parser)
    const selectorPattern = /([.#][a-zA-Z0-9_-]+)[\s{,]/g;
    const matches = [];
    let match;
    
    // Extract selectors using regex
    const content = component.content;
    while ((match = selectorPattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      const selector = match[1];
      component.selectors.push(selector);
      
      if (selector.startsWith('#')) {
        // ID selector
        component.elements.push({
          type: 'id',
          value: selector.substring(1),
          line: lineNumber
        });
      } else if (selector.startsWith('.')) {
        // Class selector
        component.elements.push({
          type: 'class',
          value: selector.substring(1),
          line: lineNumber
        });
      }
    }
  }

  /**
   * Analyze a JavaScript/TypeScript component
   * 
   * @param {CodeComponent} component - The component to analyze
   */
  analyzeJsComponent(component) {
    // Extract element references (simplified, a real implementation would use AST parsing)
    const domQueries = [
      { pattern: /document\.getElementById\(['"]([^'"]+)['"]\)/g, type: 'id' },
      { pattern: /document\.getElementsByClassName\(['"]([^'"]+)['"]\)/g, type: 'class' },
      { pattern: /document\.querySelector\(['"]([^'"]+)['"]\)/g, type: 'selector' },
      { pattern: /document\.querySelectorAll\(['"]([^'"]+)['"]\)/g, type: 'selector' }
    ];
    
    domQueries.forEach(({ pattern, type }) => {
      const matches = component.findPattern(pattern);
      matches.forEach(match => {
        const valueMatch = match.content.match(pattern);
        if (valueMatch && valueMatch[1]) {
          let value = valueMatch[1];
          
          // For querySelector, extract the actual selector type
          if (type === 'selector') {
            if (value.startsWith('#')) {
              value = value.substring(1);
              type = 'id';
            } else if (value.startsWith('.')) {
              value = value.substring(1);
              type = 'class';
            }
          }
          
          component.elements.push({
            type,
            value,
            line: match.line
          });
        }
      });
    });
    
    // Extract React component references (simplified)
    const reactPatterns = [
      { pattern: /className=["']([^"']+)["']/g, type: 'class' },
      { pattern: /id=["']([^"']+)["']/g, type: 'id' },
      { pattern: /data-test=["']([^"']+)["']/g, type: 'data-test' }
    ];
    
    reactPatterns.forEach(({ pattern, type }) => {
      const matches = component.findPattern(pattern);
      matches.forEach(match => {
        const valueMatch = match.content.match(pattern);
        if (valueMatch && valueMatch[1]) {
          const values = valueMatch[1].split(/\s+/).filter(Boolean);
          values.forEach(value => {
            component.elements.push({
              type,
              value,
              line: match.line
            });
          });
        }
      });
    });
  }
}

// Export the classes and functions
module.exports = {
  CodeAnalyzer,
  CodeComponent,
  CodebaseMap
};
