#!/usr/bin/env node

/**
 * setup.js
 * 
 * Setup script for the AI Visual Testing POC.
 * This script:
 * 1. Checks for required dependencies
 * 2. Creates necessary directories
 * 3. Sets up initial configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to create
const directories = [
  './screenshots',
  './screenshots/baseline',
  './screenshots/current',
  './screenshots/diff',
  './screenshots/verification',
  './reports',
  './logs',
  './backups',
  './src/phase4/data'
];

console.log('Setting up AI Visual Testing POC...');

// Check Node.js version
const nodeVersion = process.version;
console.log(`Node.js version: ${nodeVersion}`);

const versionMatch = nodeVersion.match(/v(\d+)\./);
if (versionMatch && Number(versionMatch[1]) < 14) {
  console.error('Error: Node.js v14 or later is required.');
  process.exit(1);
}

// Create directories
console.log('\nCreating required directories...');
directories.forEach(dir => {
  const fullPath = path.resolve(dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  } else {
    console.log(`Directory already exists: ${fullPath}`);
  }
});

// Initialize knowledge base file if it doesn't exist
const knowledgeBasePath = path.join('src', 'phase4', 'data', 'knowledge_base.json');
if (!fs.existsSync(knowledgeBasePath)) {
  fs.writeFileSync(knowledgeBasePath, '[]', 'utf-8');
  console.log(`Created knowledge base file: ${knowledgeBasePath}`);
}

// Install dependencies
console.log('\nInstalling dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed successfully.');
} catch (error) {
  console.error('Error installing dependencies:', error.message);
  process.exit(1);
}

// Check for Ollama
console.log('\nChecking for Ollama...');
try {
  execSync('ollama --version', { stdio: 'ignore' });
  console.log('Ollama is installed.');
  
  // Check for required models
  console.log('\nChecking for required models...');
  try {
    execSync('ollama list', { stdio: 'pipe' })
      .toString()
      .split('\n')
      .forEach(line => {
        if (line.includes('llama3.2')) {
          console.log('  ✓ llama3.2 model is available');
        }
        if (line.includes('llava')) {
          console.log('  ✓ llava model is available');
        }
      });
    
    console.log('\nIf models are missing, pull them with:');
    console.log('ollama pull llama3.2');
    console.log('ollama pull llava');
  } catch (err) {
    console.log('Could not check for models. Make sure Ollama is running.');
  }
} catch (error) {
  console.warn('Ollama is not installed or not in PATH. AI analysis will not work.');
  console.log('To install Ollama, visit: https://github.com/ollama/ollama');
}

// Setup complete
console.log('\nSetup complete!');
console.log('\nNext steps:');
console.log('1. Start the server: npm start');
console.log('2. Capture baseline: npm run phase4-baseline');
console.log('3. Introduce a bug: npm run phase4-bug -- --bug-type=color');
console.log('4. Run self-healing tests: npm run phase4');
