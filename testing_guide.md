# Step-by-Step Testing Guide for Phase 4 Fixes

This guide provides detailed steps to test the fixes for the AI Visual Testing system's Phase 4 self-healing capabilities.

## Prerequisites

Before beginning the testing process, ensure:

1. The server is not running (if it is, terminate it)
2. You have implemented the fixes from the implementation plan
3. Your environment has all required dependencies installed

## Step 1: Run Baseline Testing

First, let's establish a clean baseline to verify our fixes:

```bash
# Clean up any existing screenshots
rm -rf screenshots/*

# Restore original CSS
node restore-css.js

# Start server (in a separate terminal)
node start-server.js

# Capture baseline screenshots
node src/phase1/screenshot.js --baseline

# Verify all expected baseline images exist
ls -la screenshots/baseline/
```

Expected outcome: You should see baseline-full.png, baseline-header.png, baseline-main.png, and baseline-form.png in the baseline directory.

## Step 2: Introduce Controlled Visual Bug

Next, let's introduce a controlled visual bug that our system should detect and fix:

```bash
# Introduce specific CSS changes
node custom-visual-bug.js
```

This script should make the following changes to the CSS:
- Change the primary button color from blue to green
- Increase form element font size
- Change form control borders
- Change card background color

## Step 3: Run Phase 4 with Fixes

Now run the improved Phase 4 to test if it can detect and fix the visual differences:

```bash
# Run Phase 4 with debugging enabled
NODE_DEBUG=phase4 node run-phase4.js > phase4-test-output.log 2>&1
```

## Step 4: Verify Results

Check the results to verify that our fixes worked:

```bash
# Open the latest report
ls -la reports/ | sort -r | head -5

# Check the log output for evidence of our fixes working
grep -A 5 "Generating CSS fixes" phase4-test-output.log
grep -A 5 "Successfully applied fix" phase4-test-output.log
```

## Step 5: Verify CSS Fixes

Check if the CSS files were properly fixed:

```bash
# Compare current CSS with original
diff public/styles.css backups/styles-backup.css
```

The differences should be minimal or non-existent if the self-healing worked correctly.

## Expected Testing Outcomes

1. The system should identify that changes are in CSS files, not HTML
2. It should generate fixes that target the correct CSS properties
3. It should successfully apply at least some of the fixes
4. The report should indicate improved fix success rate
5. Image dimension mismatches should be handled gracefully

## Troubleshooting Common Issues

### Issue: AI Still Targeting HTML Files

If the AI is still focusing on HTML files:
- Check that the CSS prioritization logic is working
- Verify that the _isCssRelatedChange method correctly identifies CSS changes
- Review AI prompts to ensure they include CSS-specific guidance

### Issue: Line Content Verification Still Failing

If line content verification is still failing:
- Test the verifyLineContent function separately
- Check if the similarity scoring is working properly
- Add more detailed logging to track exactly where the verification is failing

### Issue: Image Path Errors Continue

If image copy errors persist:
- Verify all path.join operations are using correct parameters
- Add creation of placeholder images when originals are missing
- Check for permission issues in the file system

### Issue: Dimension Mismatch Errors

If dimension mismatch errors continue:
- Confirm the compareImages function is handling resizing correctly
- Test with both larger and smaller current images
- Add logging for each step of the comparison process

## Notes for Advanced Testing

For more rigorous testing:

1. Try multiple types of visual bugs (layout, color, font, etc.)
2. Test with different browsers to ensure cross-browser compatibility
3. Introduce random CSS changes to test the robustness of the fix generation
4. Test with larger and more complex UI components
5. Measure performance improvements in terms of fix success rate and execution time

By following this testing guide, you should be able to verify that the fixes implemented in Phase 4 are working correctly and improving the self-healing capabilities of the AI Visual Testing system.
