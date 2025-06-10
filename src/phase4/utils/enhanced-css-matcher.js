/**
 * enhanced-css-matcher.js
 * 
 * Enhanced CSS matcher for the self-healing system
 */

const fs = require('fs');
const path = require('path');

/**
 * Find a CSS rule by selector in a CSS file
 * 
 * @param {string} filePath - Path to the CSS file
 * @param {string} selector - CSS selector to find
 * @returns {Object} - Location information for the rule
 */
function findCssRule(filePath, selector) {
    try {
        if (!fs.existsSync(filePath)) {
            return { found: false, error: 'File not found' };
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        
        // Normalize selector
        const normalizedSelector = selector.trim();
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if this line contains the selector
            if (line.includes(normalizedSelector) && line.includes('{')) {
                // Look ahead for the closing brace
                let j = i;
                let ruleBody = '';
                let foundClosingBrace = false;
                
                while (j < lines.length && !foundClosingBrace) {
                    ruleBody += lines[j] + '\n';
                    if (lines[j].includes('}')) {
                        foundClosingBrace = true;
                    }
                    j++;
                }
                
                return {
                    found: true,
                    startLine: i + 1,
                    endLine: j,
                    ruleBody,
                    lines: lines.slice(i, j)
                };
            }
        }
        
        return { found: false, error: 'Selector not found' };
    } catch (error) {
        return { found: false, error: error.message };
    }
}

/**
 * Find a CSS property within a rule
 * 
 * @param {string} filePath - Path to the CSS file
 * @param {string} selector - CSS selector to find
 * @param {string} property - CSS property to find
 * @returns {Object} - Location information for the property
 */
function findCssProperty(filePath, selector, property) {
    try {
        const rule = findCssRule(filePath, selector);
        
        if (!rule.found) {
            return { found: false, error: rule.error };
        }
        
        // Normalize property
        const normalizedProperty = property.trim();
        
        for (let i = 0; i < rule.lines.length; i++) {
            const line = rule.lines[i].trim();
            
            // Check if this line contains the property
            if (line.includes(normalizedProperty) && line.includes(':')) {
                return {
                    found: true,
                    selector,
                    property,
                    line: rule.startLine + i,
                    content: line,
                    value: line.split(':')[1].split(';')[0].trim()
                };
            }
        }
        
        return { found: false, error: 'Property not found in rule' };
    } catch (error) {
        return { found: false, error: error.message };
    }
}

/**
 * Update a CSS property value
 * 
 * @param {string} filePath - Path to the CSS file
 * @param {string} selector - CSS selector
 * @param {string} property - CSS property
 * @param {string} value - New value
 * @returns {Object} - Result of the update
 */
function updateCssProperty(filePath, selector, property, value) {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        
        const propertyInfo = findCssProperty(filePath, selector, property);
        
        if (!propertyInfo.found) {
            return { success: false, error: propertyInfo.error };
        }
        
        // Line is 1-based, array is 0-based
        const lineIndex = propertyInfo.line - 1;
        
        // Replace the property value
        const currentLine = lines[lineIndex];
        const newLine = currentLine.replace(
            new RegExp(`${property}\\s*:\\s*[^;]+`),
            `${property}: ${value}`
        );
        
        lines[lineIndex] = newLine;
        
        // Write the updated content back to the file
        fs.writeFileSync(filePath, lines.join('\n'));
        
        return {
            success: true,
            selector,
            property,
            oldValue: propertyInfo.value,
            newValue: value,
            line: propertyInfo.line
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Find all CSS files in a directory
 * 
 * @param {string} directoryPath - Directory to search
 * @returns {Array<string>} - Array of CSS file paths
 */
function findCssFiles(directoryPath) {
    try {
        if (!fs.existsSync(directoryPath)) {
            return [];
        }
        
        const cssFiles = [];
        
        function scanDirectory(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip node_modules and hidden directories
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        scanDirectory(fullPath);
                    }
                } else if (entry.isFile() && entry.name.endsWith('.css')) {
                    cssFiles.push(fullPath);
                }
            }
        }
        
        scanDirectory(directoryPath);
        return cssFiles;
    } catch (error) {
        console.error(`Error finding CSS files: ${error.message}`);
        return [];
    }
}

/**
 * Detect color changes in a specific CSS rule
 * 
 * @param {string} filePath - Path to the CSS file
 * @param {string} colorBefore - Original color
 * @param {string} colorAfter - New color
 * @returns {Object} - Location information for the rule
 */
function detectColorChange(filePath, colorBefore, colorAfter) {
    try {
        if (!fs.existsSync(filePath)) {
            return { found: false, error: 'File not found' };
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Find all color properties
        const colorProperties = [
            'color',
            'background-color',
            'border-color',
            'outline-color',
            'box-shadow',
            'text-shadow'
        ];
        
        const colorMatches = [];
        
        // Find all rules with the target color
        for (const property of colorProperties) {
            const regex = new RegExp(`${property}\\s*:\\s*${colorAfter}[\\s;]`, 'g');
            let match;
            
            while ((match = regex.exec(fileContent)) !== null) {
                // Find the rule containing this match
                const lineIndex = fileContent.substring(0, match.index).split('\n').length;
                
                // Extract the selector
                let selectorStartIdx = fileContent.lastIndexOf('{', match.index);
                let selectorEndIdx = selectorStartIdx;
                
                while (selectorStartIdx > 0 && fileContent[selectorStartIdx - 1] !== '}' && fileContent[selectorStartIdx - 1] !== ';') {
                    selectorStartIdx--;
                }
                
                const selector = fileContent.substring(selectorStartIdx, selectorEndIdx).trim();
                
                colorMatches.push({
                    property,
                    value: colorAfter,
                    selector,
                    line: lineIndex,
                    originalValue: colorBefore
                });
            }
        }
        
        return {
            found: colorMatches.length > 0,
            matches: colorMatches
        };
    } catch (error) {
        return { found: false, error: error.message };
    }
}

module.exports = {
    findCssRule,
    findCssProperty,
    updateCssProperty,
    findCssFiles,
    detectColorChange
};
