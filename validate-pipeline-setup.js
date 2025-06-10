/**
 * validate-pipeline-setup.js
 * 
 * Validates that the pipeline setup is correct and ready for GitHub Actions
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Configuration
const screenshotsDir = path.join(process.cwd(), 'screenshots');
const pageNames = ['full', 'header', 'main', 'form'];

function validatePngFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, reason: 'File does not exist' };
    }
    
    const data = fs.readFileSync(filePath);
    
    // Check file size
    if (data.length < 100) {
      return { valid: false, reason: 'File too small to be a valid PNG' };
    }
    
    // Check PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (!data.subarray(0, 8).equals(pngSignature)) {
      return { valid: false, reason: 'Invalid PNG signature' };
    }
    
    // Try to parse with PNG library
    const png = PNG.sync.read(data);
    
    return { 
      valid: true, 
      width: png.width, 
      height: png.height,
      size: Math.round(data.length / 1024) + 'KB'
    };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

function validatePipelineSetup() {
  console.log('🔍 Validating Pipeline Setup\n');
  
  let issues = 0;
  let warnings = 0;
  
  // Check if required directories exist
  console.log('📁 Directory Structure:');
  const requiredDirs = [
    'screenshots',
    'screenshots/baseline',
    'reports',
    'logs',
    'src',
    '.github/workflows'
  ];
  
  requiredDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      console.log(`   ✅ ${dir}`);
    } else {
      console.log(`   ❌ ${dir} - Missing`);
      issues++;
    }
  });
  
  // Check baseline images
  console.log('\n🖼️  Baseline Images:');
  const baselineDir = path.join(screenshotsDir, 'baseline');
  
  if (!fs.existsSync(baselineDir)) {
    console.log('   ❌ Baseline directory missing');
    issues++;
  } else {
    pageNames.forEach(pageName => {
      const baselinePath = path.join(baselineDir, `baseline-${pageName}.png`);
      const validation = validatePngFile(baselinePath);
      
      if (validation.valid) {
        console.log(`   ✅ baseline-${pageName}.png (${validation.width}x${validation.height}, ${validation.size})`);
      } else {
        console.log(`   ❌ baseline-${pageName}.png - ${validation.reason}`);
        issues++;
      }
    });
  }
  
  // Check package.json scripts
  console.log('\n📦 Package.json Scripts:');
  const packagePath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const requiredScripts = [
      'fix-baseline-images',
      'create-placeholder-diffs',
      'phase1-openai',
      'phase2-openai',
      'phase3-openai',
      'phase4-openai',
      'run-all-openai'
    ];
    
    requiredScripts.forEach(script => {
      if (pkg.scripts && pkg.scripts[script]) {
        console.log(`   ✅ ${script}`);
      } else {
        console.log(`   ❌ ${script} - Missing`);
        issues++;
      }
    });
  } else {
    console.log('   ❌ package.json missing');
    issues++;
  }
  
  // Check workflow files
  console.log('\n⚙️  GitHub Workflows:');
  const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
  if (fs.existsSync(workflowsDir)) {
    const workflows = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml'));
    workflows.forEach(workflow => {
      console.log(`   ✅ ${workflow}`);
    });
    
    // Check for OpenAI workflow specifically
    const openaiWorkflow = path.join(workflowsDir, 'openai-visual-testing-workflow.yml');
    if (fs.existsSync(openaiWorkflow)) {
      const content = fs.readFileSync(openaiWorkflow, 'utf8');
      
      // Check for repository URL updates
      if (content.includes('kajee27/ai-visual-testing-poc')) {
        console.log('   ⚠️  Old repository URLs found in workflow');
        warnings++;
      }
      
      if (content.includes('VitoDD/ProofOfConcept')) {
        console.log('   ✅ Repository URLs updated correctly');
      }
    }
  } else {
    console.log('   ❌ Workflows directory missing');
    issues++;
  }
  
  // Check dependencies
  console.log('\n📚 Dependencies:');
  const nodeModulesDir = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    const requiredDeps = ['puppeteer', 'pngjs', 'pixelmatch'];
    
    requiredDeps.forEach(dep => {
      const depPath = path.join(nodeModulesDir, dep);
      if (fs.existsSync(depPath)) {
        console.log(`   ✅ ${dep}`);
      } else {
        console.log(`   ❌ ${dep} - Missing (run npm install)`);
        issues++;
      }
    });
  } else {
    console.log('   ❌ node_modules missing (run npm install)');
    issues++;
  }
  
  // Summary
  console.log('\n📊 Validation Summary:');
  console.log('========================');
  
  if (issues === 0 && warnings === 0) {
    console.log('🎉 Perfect! Pipeline setup is complete and ready for GitHub Actions.');
    console.log('\n🚀 Next steps:');
    console.log('   1. Commit and push your changes');
    console.log('   2. Go to GitHub Actions tab');
    console.log('   3. Run "OpenAI Visual Testing Workflow"');
    console.log('   4. Select "all" for complete testing');
  } else {
    if (issues > 0) {
      console.log(`❌ ${issues} critical issues found that need to be fixed`);
    }
    if (warnings > 0) {
      console.log(`⚠️  ${warnings} warnings found (pipeline will work but should be addressed)`);
    }
    
    console.log('\n🔧 Recommended fixes:');
    if (issues > 0) {
      console.log('   • Run: npm install');
      console.log('   • Run: npm run setup');
      console.log('   • Run: npm run fix-baseline-images');
    }
  }
  
  return { issues, warnings };
}

// Execute validation
if (require.main === module) {
  validatePipelineSetup();
}

module.exports = { validatePipelineSetup };
