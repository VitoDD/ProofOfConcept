/**
 * Enhanced Phase 1 Runner
 * 
 * This script serves as a comprehensive entry point for running Phase 1 
 * with multiple steps in sequence:
 * 1. Capture baseline screenshots (if they don't exist)
 * 2. Introduce comprehensive visual bugs
 * 3. Apply enhanced visualization settings
 * 4. Run comparison and generate reports
 */

const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);

// Skip specific steps if requested
const skipBaseline = args.includes('--skip-baseline');
const skipBugs = args.includes('--skip-bugs');
const skipEnhancement = args.includes('--skip-enhancement');
const skipComparison = args.includes('--skip-comparison');

// Get paths
const workflowPath = path.join(__dirname, 'src', 'phase1', 'workflow.js');
const baselineDir = path.join(__dirname, 'screenshots', 'baseline');

console.log(`Running Enhanced Phase 1: Comprehensive Visual Testing`);
console.log('-'.repeat(60));

/**
 * Runs a command as a child process and returns a promise
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      ...options,
      stdio: 'inherit',
      shell: true
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main execution function
 */
async function runEnhancedPhase1() {
  try {
    // 1. Capture baseline if needed and not skipped
    const baselineExists = fs.existsSync(baselineDir) && 
                          fs.readdirSync(baselineDir).some(file => file.includes('baseline'));
    
    if (!baselineExists && !skipBaseline) {
      console.log('\n--- Step 1: Capturing Baseline Screenshots ---');
      await runCommand('node', [workflowPath, '--baseline']);
      console.log('✅ Baseline screenshots captured');
    } else if (skipBaseline) {
      console.log('\n--- Step 1: Skipping Baseline Capture (--skip-baseline) ---');
    } else {
      console.log('\n--- Step 1: Skipping Baseline Capture (baseline already exists) ---');
    }
    
    // 2. Introduce comprehensive visual bugs
    if (!skipBugs) {
      console.log('\n--- Step 2: Introducing Comprehensive Visual Bugs ---');
      await runCommand('node', ['comprehensive-visual-bug.js']);
      console.log('✅ Visual bugs introduced');
    } else {
      console.log('\n--- Step 2: Skipping Bug Introduction (--skip-bugs) ---');
    }
    
    // 3. Apply enhanced visualization
    if (!skipEnhancement) {
      console.log('\n--- Step 3: Enhancing Diff Visualization ---');
      await runCommand('node', ['enhanced-visual-bug.js']);
      console.log('✅ Diff visualization enhanced');
    } else {
      console.log('\n--- Step 3: Skipping Visualization Enhancement (--skip-enhancement) ---');
    }
    
    // 4. Run comparison
    if (!skipComparison) {
      console.log('\n--- Step 4: Running Visual Comparison ---');
      await runCommand('node', [workflowPath]);
      console.log('✅ Visual comparison completed');
    } else {
      console.log('\n--- Step 4: Skipping Comparison (--skip-comparison) ---');
    }
    
    // Success message
    console.log('\n✅ Enhanced Phase 1 completed successfully!');
    console.log('Reports are available in the reports directory.');
    console.log('To view the reports, run: npm run view-reports');
    
  } catch (error) {
    console.error(`\n❌ Enhanced Phase 1 failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the enhanced Phase 1
runEnhancedPhase1();
