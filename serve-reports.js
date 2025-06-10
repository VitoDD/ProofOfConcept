/**
 * serve-reports.js
 * 
 * A simple Express server to serve the generated reports with proper image paths.
 * This is helpful when viewing reports locally without the main server running.
 */

const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Serve reports directory as static files
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Serve screenshots directory for image access
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Redirect root to reports directory
app.get('/', (req, res) => {
  res.redirect('/reports');
});

// Start the server
app.listen(port, () => {
  console.log(`Report server running at http://localhost:${port}`);
  console.log(`View your reports at http://localhost:${port}/reports`);
});
