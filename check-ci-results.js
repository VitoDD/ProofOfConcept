#!/usr/bin/env node

/**
 * check-ci-results.js
 * 
 * Script to check what results are available after a CI run
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking CI Results...\n');

// Check reports directory
const reportsDir = path.join(__dirname, 'reports');
if (fs.existsSync(reportsDir)) {
  console.log('📊 Reports Directory:');
  const reports = fs.readdirSync(reportsDir);
  reports.forEach(file => {
    const filePath = path.join(reportsDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)}KB, ${stats.mtime.toISOString()})`);
  });
  console.log('');
} else {
  console.log('❌ No reports directory found\n');
}

// Check screenshots directory
const screenshotsDir = path.join(__dirname, 'screenshots');
if (fs.existsSync(screenshotsDir)) {
  console.log('📸 Screenshots Directory:');
  
  ['baseline', 'current', 'diff'].forEach(type => {
    const typeDir = path.join(screenshotsDir, type);
    if (fs.existsSync(typeDir)) {
      console.log(`  ${type}:`);
      const files = fs.readdirSync(typeDir);
      
      files.forEach(file => {
        if (file.endsWith('.png')) {
          const filePath = path.join(typeDir, file);
          const stats = fs.statSync(filePath);
          console.log(`    - ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
        } else if (fs.statSync(path.join(typeDir, file)).isDirectory()) {
          // Check timestamp directories
          console.log(`    📁 ${file}/`);
          const timestampFiles = fs.readdirSync(path.join(typeDir, file));
          timestampFiles.forEach(tsFile => {
            if (tsFile.endsWith('.png')) {
              const tsFilePath = path.join(typeDir, file, tsFile);
              const tsStats = fs.statSync(tsFilePath);
              console.log(`      - ${tsFile} (${(tsStats.size / 1024).toFixed(1)}KB)`);
            }
          });
        }
      });
    }
  });
  console.log('');
} else {
  console.log('❌ No screenshots directory found\n');
}

// Check logs directory
const logsDir = path.join(__dirname, 'logs');
if (fs.existsSync(logsDir)) {
  console.log('📋 Logs Directory:');
  const logs = fs.readdirSync(logsDir);
  logs.forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)}KB, ${stats.mtime.toISOString()})`);
  });
  console.log('');
} else {
  console.log('❌ No logs directory found\n');
}

// Check for latest report
const latestReport = findLatestReport();
if (latestReport) {
  console.log(`🎯 Latest Report: ${latestReport}`);
  console.log(`📍 View at: http://localhost:3000/reports/${path.basename(latestReport)}`);
  console.log(`📍 Or open directly: file://${latestReport}`);
} else {
  console.log('❌ No reports found');
}

console.log('\n✅ Results check complete!');
console.log('\n💡 To view results locally:');
console.log('   1. npm run start-server');
console.log('   2. Open http://localhost:3000');
console.log('   3. Navigate to /reports for test reports');

function findLatestReport() {
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) return null;
  
  const htmlFiles = fs.readdirSync(reportsDir)
    .filter(file => file.endsWith('.html'))
    .map(file => ({
      name: file,
      path: path.join(reportsDir, file),
      mtime: fs.statSync(path.join(reportsDir, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);
  
  return htmlFiles.length > 0 ? htmlFiles[0].path : null;
}
