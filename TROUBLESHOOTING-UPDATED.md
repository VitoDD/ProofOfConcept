# Troubleshooting Guide for Phase 3 Implementation

This guide covers common issues and solutions for the Phase 3 implementation of the AI Visual Testing PoC.

## Quick Fix Commands

If you're experiencing issues with Phase 3, try these commands in order:

1. **Create placeholder diff images**: 
   ```
   npm run create-placeholder-diffs
   ```
   This will create all necessary baseline, current, and diff images.

2. **Fix existing diff images**:
   ```
   npm run fix-diff-images
   ```
   This ensures existing diff images are in all the required locations.

3. **Run Phase 3 in safe mode**:
   ```
   npm run phase3-safe
   ```
   This creates placeholder diff images and then runs Phase 3.

4. **Skip AI analysis if all else fails**:
   ```
   npm run phase3-skip-ai
   ```
   This runs Phase 3 without AI analysis, which avoids diff image issues.

## Common Issues

### 1. Missing Diff Images

**Symptoms**:
- Errors like: `Diff image not found: E:\ClaudeAccess\Gitlab\ai-visual-testing-poc\reports\diff-full.png`
- AI analysis fails with "not found" errors

**Solutions**:
- Run the placeholder creation utility:
  ```
  npm run create-placeholder-diffs
  ```
- This will create all necessary baseline, current, and diff images.

### 2. Path Not Defined Error

**Symptoms**:
- Error: `Error ensuring diff images: path is not defined`

**Solution**:
- This issue should now be fixed with the updated code.
- If you still encounter it, run:
  ```
  npm run phase3-safe
  ```

### 3. AI Analysis Errors

**Symptoms**:
- Warnings like: `AI analysis returned error or incomplete result for ...`
- No AI analysis in the report

**Solutions**:
- Check if Ollama is running:
  ```
  npm run check-ollama
  ```
- If Ollama is running but you still get errors, try the safe mode:
  ```
  npm run phase3-safe
  ```
- As a last resort, skip AI analysis:
  ```
  npm run phase3-skip-ai
  ```

### 4. Incorrect Diff Image Paths

**Symptoms**:
- Errors about finding diff images in unexpected locations
- Issues with paths in reports

**Solution**:
- The system now looks for diff images in multiple locations:
  - `reports/diff-*.png`
  - `screenshots/diff/diff-*.png`
  - `reports/*.png` (without `diff-` prefix)
- Run the fix utility to ensure images exist in all locations:
  ```
  npm run fix-diff-images
  ```

## Advanced Troubleshooting

### Manually Creating Diff Images

If you need to manually create diff images:

1. Capture baseline screenshots:
   ```
   npm run phase3-baseline
   ```

2. Capture current screenshots:
   ```
   npm run capture
   ```

3. Generate diff images:
   ```
   npm run compare
   ```

4. Fix diff image locations:
   ```
   npm run fix-diff-images
   ```

### Checking Directory Structure

The system requires these directories to exist:
- `reports/` - For storing reports and diff images
- `screenshots/` - For storing baseline and current screenshots
- `screenshots/diff/` - For storing diff images

These directories are now created automatically, but you can check them with:
```
ls -la reports
ls -la screenshots
ls -la screenshots/diff
```

### Logging

Check these log files for detailed error information:
- `logs/phase3-workflow.log`
- `logs/ai-visual-testing.log`
- `logs/server.log`

## Prevention

To prevent issues in the future:

1. Always use the safe mode when you're not sure:
   ```
   npm run phase3-safe
   ```

2. After making changes to the codebase, run:
   ```
   npm run fix-diff-images
   ```

3. If you encounter new error types, please report them so we can improve the error handling.
