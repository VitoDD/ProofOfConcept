/**
 * server.js
 * 
 * Express server for hosting the test application.
 * This serves static files from the public directory and provides API endpoints
 * for the visual testing functions.
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { IntentConfirmationManager } = require('./utils/intent-confirmation');
const app = express();

// Initialize the intent confirmation manager
const intentConfirmationManager = new IntentConfirmationManager();

// Parse JSON request bodies
app.use(express.json());

/**
 * Starts the server on the specified port and host
 * 
 * @param {number} port - Port to listen on
 * @param {string} host - Host to bind to
 * @returns {Promise<object>} - Server instance
 */
function startServer(port = 3000, host = 'localhost') {
  return new Promise(async (resolve, reject) => {
    try {
      // Initialize the intent confirmation manager
      await intentConfirmationManager.initialize();
      // Serve static files from the public directory
      app.use(express.static(path.join(__dirname, '../public')));
      
      // Serve screenshots directory
      app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));
      
      // Serve reports directory
      app.use('/reports', express.static(path.join(__dirname, '../reports')));
      
      // Direct endpoint for images that handles serving with full paths
      app.get('/direct-image/:type/:path(*)', (req, res) => {
        try {
          const { type, path: imagePath } = req.params;
          const screenshotsDir = path.join(__dirname, '../screenshots');
          
          // Determine the base directory for this type
          const typeDir = path.join(screenshotsDir, type);
          
          // Create full path to the image
          const fullPath = path.join(typeDir, imagePath);
          
          // Check if file exists
          if (fsSync.existsSync(fullPath)) {
            return res.sendFile(fullPath);
          }
          
          // If not found directly, check timestamp directories if type is current or diff
          if (type === 'current' || type === 'diff') {
            try {
              // Get timestamp directories
              const dirs = fsSync.readdirSync(typeDir);
              
              // Try each directory
              for (const dir of dirs) {
                if (dir.match(/\d{4}-\d{2}-\d{2}T/)) {
                  const timestampPath = path.join(typeDir, dir, imagePath);
                  if (fsSync.existsSync(timestampPath)) {
                    return res.sendFile(timestampPath);
                  }
                }
              }
            } catch (dirError) {
              console.error(`Error checking timestamp directories: ${dirError.message}`);
            }
          }
          
          // If we got here, file not found
          res.status(404).send(`Image not found: ${imagePath}`);
        } catch (error) {
          console.error(`Error serving image: ${error.message}`);
          res.status(500).send(`Error serving image: ${error.message}`);
        }
      });
      
      // API endpoint for server status
      app.get('/api/status', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
      
      // API endpoint for intent confirmations
      app.get('/api/intent-confirmations', async (req, res) => {
        try {
          const pending = intentConfirmationManager.getAllPendingConfirmations();
          const processed = intentConfirmationManager.getAllProcessedConfirmations();
          
          res.json({
            pending,
            processed
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // API endpoint for processing confirmations
      app.post('/api/intent-confirmations/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const { isIntended } = req.body;
          
          if (typeof isIntended !== 'boolean') {
            return res.status(400).json({ error: 'isIntended field is required and must be a boolean' });
          }
          
          const result = await intentConfirmationManager.processConfirmation(id, isIntended);
          
          res.json({
            success: true,
            result
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // API endpoint for registering new pending confirmations
      app.post('/api/intent-confirmations', async (req, res) => {
        try {
          const { issue } = req.body;
          
          if (!issue || !issue.name) {
            return res.status(400).json({ error: 'issue field is required and must contain a name' });
          }
          
          const confirmationId = await intentConfirmationManager.registerPendingConfirmation(issue);
          
          res.json({
            success: true,
            confirmationId
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // API endpoint to serve image files for the confirmation UI
      app.get('/api/images/:type/:name', (req, res) => {
        try {
          const { type, name } = req.params;
          
          // Validate type to prevent directory traversal
          if (!['baseline', 'current', 'diff', 'verification'].includes(type)) {
            return res.status(400).json({ error: 'Invalid image type' });
          }
          
          // Sanitize name to prevent path traversal
          const sanitizedName = path.basename(name);
          
          // Add .png extension if missing
          const nameWithExt = sanitizedName.endsWith('.png') ? sanitizedName : `${sanitizedName}.png`;
          
          // Try multiple possible locations
          const possibleLocations = [
            // Standard location
            path.join(process.cwd(), 'screenshots', type, nameWithExt),
            path.join(process.cwd(), 'screenshots', type, sanitizedName),
            
            // In reports directory
            path.join(process.cwd(), 'reports', `${type}-${nameWithExt}`),
            path.join(process.cwd(), 'reports', `${type}-${sanitizedName}`),
            path.join(process.cwd(), 'reports', nameWithExt),
            path.join(process.cwd(), 'reports', sanitizedName),
            
            // Direct files for legacy purposes
            path.join(process.cwd(), nameWithExt),
            path.join(process.cwd(), sanitizedName),
            path.join(process.cwd(), `${type}-${nameWithExt}`),
            path.join(process.cwd(), `${type}-${sanitizedName}`)
          ];
          
          // Log info about attempt
          console.log(`Looking for image: ${type}/${sanitizedName} (with or without .png extension)`);
          
          // Try each location until we find the file
          let filePath = null;
          for (const location of possibleLocations) {
            try {
              if (fsSync.existsSync(location)) {
                filePath = location;
                console.log(`✅ Found image at: ${location}`);
                break;
              }
            } catch (err) {
              // File not found at this location, try the next one
              console.log(`❌ Not found at: ${location}`);
              continue;
            }
          }
          
          // Try timestamp directories if not found yet
          if (!filePath) {
            const timestampDirs = findTimestampDirs(path.join(process.cwd(), 'screenshots', type));
            for (const dir of timestampDirs) {
              const location1 = path.join(dir, nameWithExt);
              const location2 = path.join(dir, sanitizedName);
              
              if (fsSync.existsSync(location1)) {
                filePath = location1;
                console.log(`✅ Found image in timestamp dir: ${location1}`);
                break;
              }
              
              if (fsSync.existsSync(location2)) {
                filePath = location2;
                console.log(`✅ Found image in timestamp dir: ${location2}`);
                break;
              }
            }
          }
          
          if (!filePath) {
            return res.status(404).json({ 
              error: 'Image not found', 
              attemptedLocations: possibleLocations.map(p => p.replace(process.cwd(), ''))
            });
          }
          
          // Log success for debugging
          console.log(`Found image at: ${filePath.replace(process.cwd(), '')}`);
          
          // Send the file
          res.sendFile(filePath);
        } catch (error) {
          console.error(`Error serving image: ${error.message}`);
          res.status(500).json({ error: error.message });
        }
      });
      
      /**
       * Helper function to find timestamp directories in a parent directory
       * Returns an array of full paths to timestamp directories, sorted by newest first
       */
      function findTimestampDirs(parentDir) {
        try {
          // Get all subdirectories that look like timestamps
          const timestampDirRegex = /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;
          
          try {
            const dirs = fsSync.readdirSync(parentDir, { withFileTypes: true })
              .filter(dirent => dirent.isDirectory() && timestampDirRegex.test(dirent.name))
              .map(dirent => path.join(parentDir, dirent.name));
            
            // Sort by newest first (assuming timestamp format in directory name)
            return dirs.sort((a, b) => {
              const timeA = path.basename(a).replace(/[^\d]/g, '');
              const timeB = path.basename(b).replace(/[^\d]/g, '');
              return timeB.localeCompare(timeA);
            });
          } catch (err) {
            // Directory doesn't exist or can't be read
            console.log(`Can't read directory ${parentDir}: ${err.message}`);
            return [];
          }
        } catch (error) {
          console.error(`Error finding timestamp directories: ${error.message}`);
          return [];
        }
      }
      
      // Start the server
      const server = app.listen(port, host, () => {
        console.log(`Test application server running at http://${host}:${port}`);
        console.log(`Access the test app at http://${host}:${port}`);
        resolve(server);
      });
      
      server.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// If this script is run directly, start the server
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || 'localhost';
  
  startServer(port, host).catch(error => {
    console.error(`Error starting server: ${error.message}`);
    process.exit(1);
  });
}

// Export functions
module.exports = {
  startServer,
  app
};
