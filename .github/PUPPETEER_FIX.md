# Puppeteer Installation Fix for GitHub Actions

## Problem
The workflow was failing with this error:
```
Error: Cannot find module './index.js'
Require stack:
- .../node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js
```

This indicates a corrupted or incomplete Puppeteer installation.

## Root Causes
1. **Incomplete Puppeteer installation** - Browser binaries not downloaded properly
2. **Missing system dependencies** - Required libraries for headless Chrome
3. **Environment variable issues** - Puppeteer cache/download settings
4. **Module resolution problems** - Corrupted node_modules

## Fixes Applied

### 1. System Dependencies
Added installation of required libraries for headless Chrome:
```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libgtk-3-0 libgbm-dev libxss1 libasound2 libxtst6 \
      libxrandr2 libpangocairo-1.0-0 libatk1.0-0 \
      libcairo-gobject2 libgdk-pixbuf2.0-0
```

### 2. Environment Variables
Set proper Puppeteer environment variables:
```yaml
env:
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: false
  PUPPETEER_CACHE_DIR: ~/.cache/puppeteer
```

### 3. Robust Installation Process
```yaml
- name: Install dependencies
  run: |
    npm install
    # Verify Puppeteer installation
    node -e "console.log('Puppeteer version:', require('puppeteer/package.json').version)"
    # Install browsers with retry logic
    for i in {1..3}; do
      if npx puppeteer browsers install chrome; then
        echo "Chrome browser installed successfully"
        break
      else
        echo "Attempt $i failed, retrying..."
        sleep 5
      fi
    done
```

### 4. Installation Test & Recovery
Added a test script (`test-puppeteer.js`) that:
- Validates Puppeteer can launch a browser
- Tests basic functionality
- Provides detailed error information
- Triggers reinstallation if test fails

### 5. Debug Information
Added comprehensive debugging to help diagnose issues:
- Node/NPM versions
- Puppeteer cache contents
- Chrome binary locations
- Module loading tests

## Testing
To test Puppeteer locally:
```bash
npm run test-puppeteer
```

## Expected Results
After these fixes, the workflow should:
1. ✅ Install all required system dependencies
2. ✅ Download Puppeteer and Chrome browser successfully
3. ✅ Pass the Puppeteer functionality test
4. ✅ Run Phase 1 visual testing without module errors

## Troubleshooting
If Puppeteer issues persist:

1. **Check the debug output** in the "Debug Puppeteer installation" step
2. **Look for browser installation errors** in the logs
3. **Verify system dependencies** are installed correctly
4. **Check if the test-puppeteer.js** step passes

## Manual Recovery
If automated recovery fails, the workflow will:
1. Uninstall Puppeteer completely
2. Reinstall from scratch
3. Re-download Chrome browser
4. Retest functionality

This ensures maximum reliability for the visual testing pipeline.
