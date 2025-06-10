# Phase 1: Basic Visual Testing Framework

This phase establishes the foundation for visual testing by setting up the environment and implementing core screenshot comparison capabilities.

## Goals

1. Create a reliable web application test environment
2. Implement screenshot capture and comparison functionality
3. Detect visual differences with configurable precision
4. Establish reporting infrastructure for visual changes

## Components

### Server Setup (`server.js`)

- Express server hosting a test application with various UI elements
- RESTful endpoints for application status monitoring
- Configurable port (default: 3000) for local development
- Serves static content from the `public` directory

### Screenshot Capture (`screenshot.js`)

- Puppeteer-based headless browser automation
- Captures full-page and element-specific screenshots
- Support for various viewport sizes and device emulation
- Consistent naming conventions for baseline and current images

### Image Comparison (`compare.js`)

- Pixel-by-pixel comparison using pixelmatch
- Configurable threshold for detection sensitivity
- Generation of visual difference maps highlighting changes
- Calculation of difference metrics (pixel count, percentage)

### Visual Bug Simulation (`create-visual-bug.js`)

- Controlled introduction of visual changes for testing
- Multiple bug types: color, layout, spacing, font, content
- Configurable severity levels for each bug type
- Ability to revert changes to original state

### Workflow Integration (`workflow.js`)

- End-to-end testing process orchestration
- Command-line options for different modes (baseline, bug, comparison)
- HTML report generation with visual indicators
- Integration with npm scripts for simplified usage

## Key Features

### Reliable Screenshot Capture

- Waits for page to fully load before capturing
- Ensures consistent viewport sizes across runs
- Handles dynamic content with wait mechanisms
- Supports both desktop and mobile viewports

### Precise Visual Comparison

- Multiple comparison strategies based on context
- Handles slight rendering differences to reduce noise
- Configurable threshold for different sensitivity needs
- Supports both exact and fuzzy matching

### Comprehensive Reporting

- HTML reports with side-by-side image comparison
- Difference highlights with color-coded indicators
- Metrics for quantifying visual differences
- Organized directory structure for results

### Flexible Bug Simulation

- Targeted changes to specific elements
- Systematic approach to test various bug scenarios
- Support for multiple simultaneous changes
- Consistent reversion to original state

## Usage

### Basic Commands

```bash
# Install dependencies
npm install

# Start the test application server
npm run start-server

# Capture baseline screenshots
npm run baseline

# Introduce a visual bug
npm run bug -- --bug-type=color

# Run comparison and generate report
npm run workflow

# Revert introduced bugs
npm run revert-bug
```

### Available Bug Types

- `color`: Changes element colors and backgrounds
- `layout`: Adjusts element positioning and alignment
- `spacing`: Modifies margins and padding
- `font`: Changes typography styles and sizes
- `content`: Alters text content and images
- `button`: Modifies button appearance and behavior
- `multiple`: Introduces several changes simultaneously

### Configuration Options

The workflow supports various command-line options:

```
--baseline           Capture baseline screenshots
--bug                Introduce a visual bug
--bug-type=TYPE      Specify type of bug to introduce
--threshold=VALUE    Set comparison threshold (0.0-1.0)
--element=SELECTOR   Target specific element by CSS selector
```

## Project Structure

```
phase1/
├── compare.js             # Image comparison logic
├── create-visual-bug.js   # Bug simulation utilities
├── original-styles.css    # Backup of original styling
├── README.md              # This documentation
├── screenshot.js          # Screenshot capture utilities
└── workflow.js            # Main workflow orchestration
```

## Integration with Next Phases

Phase 1 provides the foundational components that will be enhanced by:

- Phase 2: AI-powered visual analysis
- Phase 3: Code-UI mapping and issue localization
- Phase 4: Self-healing capabilities

## Testing and Validation

All components include comprehensive error handling and validation:

- Checks for server availability before capturing screenshots
- Validates image existence before comparison
- Handles browser crashes and network issues
- Provides detailed error reporting

## Next Steps

After establishing this foundation, Phase 2 will integrate AI capabilities to enhance visual testing by providing intelligent analysis of detected differences and reducing false positives.
