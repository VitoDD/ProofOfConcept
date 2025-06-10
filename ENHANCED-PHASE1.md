# Enhanced Phase 1 Visual Testing

This document explains the updated behavior of the Phase 1 visual testing process.

## New Default Behavior

The `npm run phase1` command now runs an enhanced workflow by default:

1. Captures baseline screenshots (if they don't exist)
2. Introduces comprehensive visual bugs (text truncation, missing elements, color contrast issues, layout shifts)
3. Enhances diff visualization for better LLaVA-2 detection
4. Runs the comparison and generates reports

This creates a more comprehensive test that's better suited for LLaVA-2 analysis.

## Command Options

You can control the behavior with these commands:

```bash
# Run the enhanced workflow (default)
npm run phase1

# Run only the standard workflow without comprehensive bugs
npm run phase1 --standard

# Only capture baseline screenshots
npm run phase1-baseline

# Only introduce simple bug
npm run phase1-bug

# Run enhanced workflow with specific steps skipped
npm run phase1 --skip-baseline  # Skip baseline capture
npm run phase1 --skip-bugs      # Skip introducing bugs
npm run phase1 --skip-enhancement  # Skip diff enhancement
npm run phase1 --skip-comparison   # Skip the comparison step
```

## Viewing Reports

After running any of these commands, you can view the reports by running:

```bash
npm run view-reports
```

This will start a server and open your browser to view the generated reports.

## Enhanced Visualization

The enhanced workflow produces better diff visualizations:

- Higher contrast highlighting of differences
- Better visualization of dimension mismatches
- Colored borders to highlight size differences
- Improved alpha settings for better visibility

## Comprehensive Visual Bugs

The enhanced workflow introduces multiple types of bugs:

1. **Text Truncation** - Information paragraph is truncated
2. **Missing Elements** - Reset button is removed from the form
3. **Color Contrast Issues** - Text color changed to light gray
4. **Layout Shifts** - Elements misaligned and overlapping

These bugs are designed to be easily identifiable by LLaVA-2 for automated analysis.
