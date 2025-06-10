/**
 * Check Ollama Availability
 * 
 * This script verifies that Ollama is running and has the required models installed.
 * It's used as a prerequisite check before running AI-enhanced tests.
 */

const http = require('http');

// Check if Ollama is running
function checkOllamaAvailability() {
  return new Promise((resolve, reject) => {
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
          const response = JSON.parse(data);
          
          if (response.models) {
            // Check for required models
            const models = response.models.map(model => model.name.toLowerCase());
            const requiredModels = ['llava', 'llama3.2'];
            const missingModels = requiredModels.filter(model => 
              !models.some(m => m.includes(model))
            );
            
            if (missingModels.length === 0) {
              console.log('✅ Ollama is running with all required models:');
              console.log(`Found models: ${models.join(', ')}`);
              resolve(true);
            } else {
              console.log('⚠️ Ollama is running but missing required models:');
              console.log(`Missing: ${missingModels.join(', ')}`);
              console.log('Please install missing models with:');
              missingModels.forEach(model => {
                console.log(`  ollama pull ${model}`);
              });
              resolve(false);
            }
          } else {
            console.log('⚠️ Ollama is running but no models found. Please install required models:');
            console.log('  ollama pull llava');
            console.log('  ollama pull llama3.2');
            resolve(false);
          }
        } catch (error) {
          console.error('❌ Error parsing Ollama response:', error.message);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Ollama is not running. Please start Ollama with:');
        console.error('  ollama serve');
        resolve(false);
      } else {
        console.error('❌ Error connecting to Ollama:', error.message);
        reject(error);
      }
    });
    
    req.on('timeout', () => {
      console.error('❌ Connection to Ollama timed out. Is Ollama running?');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Main function
async function main() {
  try {
    const isAvailable = await checkOllamaAvailability();
    process.exit(isAvailable ? 0 : 1);
  } catch (error) {
    console.error('❌ Failed to check Ollama availability:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
