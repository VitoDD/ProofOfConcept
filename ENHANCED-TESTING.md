# Enhanced Visual Testing with LLaVA-2

This documentation explains how the visual testing system has been enhanced for better LLaVA-2 integration.

## Phase 1 Enhancements

Running `npm run phase1` now automatically:

1. Captures baseline screenshots (if they don't exist)
2. Introduces comprehensive visual bugs:
   - **Text truncation**: Information paragraph is truncated
   - **Missing elements**: Reset button is removed
   - **Color contrast issues**: Text color changed to low contrast gray
   - **Layout shifts**: Elements misaligned and overlapping
3. Enhances diff visualization with:
   - Higher contrast highlighting of differences
   - Better visualization of dimension mismatches
   - Colored borders for size differences
   - Improved alpha settings for visibility
4. Runs the comparison and generates detailed reports

## Phase 2 Enhancements

Running `npm run phase2` now automatically includes LLaVA-2 optimized prompts that:

1. Direct the AI to specifically look for the four bug types:
   - Text truncation
   - Missing elements
   - Color contrast issues
   - Layout shifts

2. Request structured analysis for each issue:
   - The specific UI element affected
   - The type of issue
   - Impact on usability
   - Severity rating

## How to Use

The standard workflow is now:

```bash
# Run Phase 1 to introduce comprehensive visual bugs
npm run phase1

# Run Phase 2 to analyze the bugs with AI
npm run phase2
```

### Additional Options

If you want to run the phases without the enhancements:

```bash
# Run Phase 1 without comprehensive bugs
npm run phase1 --standard

# Run Phase 2 without enhanced prompts
npm run phase2 --skip-enhancement
```

Other useful commands:

```bash
# Only capture baseline screenshots
npm run phase1-baseline

# Skip specific steps in Phase 1
npm run phase1 --skip-baseline  # Skip baseline capture
npm run phase1 --skip-bugs      # Skip introducing bugs
npm run phase1 --skip-enhancement  # Skip diff enhancement
npm run phase1 --skip-comparison   # Skip the comparison step

# Skip AI analysis in Phase 2
npm run phase2 --skip-ai
```

## Viewing Reports

After running either phase, view the reports:

```bash
npm run view-reports
```

This will start a server and open your browser to view the generated reports.

## Benefits for LLaVA-2 Integration

These enhancements make the system more suitable for LLaVA-2 analysis by:

1. Creating visually distinct bugs that are easier for AI to identify
2. Generating clearer diff visualizations
3. Using prompts that direct the AI to look for specific bug types
4. Requesting structured output that can be further processed
5. Creating a complete pipeline from bug introduction to AI analysis
