/**
 * Phase 1 Runner
 * 
 * This script serves as a simplified entry point for running Phase 1 (Basic Visual Testing)
 * Now by default, it runs the enhanced version with comprehensive bugs unless specific flags are provided
 */

const path = require('path');
const { spawn } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);

// Check for specific modes
const shouldCaptureBaseline = args.includes('--baseline');
const shouldIntroduceBug = args.includes('--bug');
const useStandardMode = args.includes('--standard');

// If baseline or bug flags are provided, use the standard workflow
// Otherwise, use the enhanced workflow by default
if (shouldCaptureBaseline || shouldIntroduceBug || useStandardMode) {
  // Standard workflow - just capture baseline or introduce simple bug
  console.log(`Running Phase 1: Standard Visual Testing`);
  console.log('-'.repeat(40));
  
  // Add path to workflow file
  const workflowPath = path.join(__dirname, 'src', 'phase1', 'workflow.js');
  
  // If neither baseline nor bug flags are provided, just run the comparison
  const effectiveArgs = args.length > 0 ? args : [];
  
  // Spawn the Phase 1 workflow process
  const childProcess = spawn('node', [workflowPath, ...effectiveArgs], {
    stdio: 'inherit',
    shell: true
  });
  
  // Handle process exit
  childProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Phase 1 completed successfully!');
      console.log('Reports are available in the reports directory.');
    } else {
      console.error(`\n❌ Phase 1 failed with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle errors
  childProcess.on('error', (err) => {
    console.error(`❌ Failed to start Phase 1 workflow: ${err.message}`);
    process.exit(1);
  });
} else {
  // Enhanced workflow - run the comprehensive visual testing
  console.log(`Running Phase 1: Enhanced Visual Testing with Comprehensive Bugs`);
  console.log('-'.repeat(60));
  
  // Spawn the enhanced Phase 1 workflow process
  const enhancedPath = path.join(__dirname, 'run-enhanced-phase1.js');
  
  const childProcess = spawn('node', [enhancedPath, ...args], {
    stdio: 'inherit',
    shell: true
  });
  
  // Handle process exit
  childProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Enhanced Phase 1 completed successfully!');
      console.log('Reports are available in the reports directory.');
      console.log('To view the reports, run: npm run view-reports');
    } else {
      console.error(`\n❌ Enhanced Phase 1 failed with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle errors
  childProcess.on('error', (err) => {
    console.error(`❌ Failed to start Enhanced Phase 1 workflow: ${err.message}`);
    process.exit(1);
  });
}
