# AI Visual Testing POC - Project Structure

This document outlines the directory structure and file organization of the AI Visual Testing Proof of Concept project.

## Root Directory

The root directory contains project configuration files, scripts, and main directories:

```
E:\ClaudeAccess\Gitlab\ai-visual-testing-poc\
├── .git/                              # Git repository data
├── .github/                           # GitHub configuration files
├── backups/                           # Automated backups of files before modification
├── logs/                              # Log files directory
├── node_modules/                      # Node.js dependencies
├── public/                            # Public assets for the test application
├── reports/                           # Generated test reports and comparison results
├── screenshots/                       # Screenshot images for testing
├── src/                               # Source code organized by implementation phases
├── test/                              # Test files
├── .gitignore                         # Git ignore file
├── advanced_strategies.md             # Documentation for advanced strategies
├── capture-all-baselines.js           # Script to capture baseline screenshots
├── check-ollama.js                    # Script to check Ollama AI service availability
├── code_implementation.md             # Documentation for code implementation
├── config.json                        # Configuration settings for the application
├── create-placeholder-diffs.js        # Script to create placeholder diff images
├── custom-visual-bug.js               # Script to introduce custom visual bugs
├── DIFF-IMAGE-TROUBLESHOOTING.md      # Troubleshooting guide for diff image issues
├── enhanced-visual-bug.js             # Script for enhanced visual bug testing
├── error_logs.txt                     # Error logs from test runs
├── error_logs_fix.md                  # Documentation of error fixes
├── final_report.md                    # Final report of the POC
├── fix-diff-images.js                 # Script to fix diff image issues
├── folderstructure.md                 # This file - project structure documentation
├── force-visual-diff.js               # Script to force visual differences
├── implementation_guide.md            # Guide for implementation
├── implementation_plan.md             # Project implementation plan
├── OLLAMA-TROUBLESHOOTING.md          # Troubleshooting guide for Ollama
├── one-step-bug.js                    # Script for one-step bug testing
├── package-lock.json                  # NPM package lock file
├── package.json                       # NPM package configuration
├── PHASE4.md                          # Documentation for Phase 4
├── README.md                          # Project README
├── restore-css.js                     # Script to restore CSS changes
├── run-fix.bat                        # Batch file to run fixes
├── run-phase3-without-ai.js           # Script to run Phase 3 without AI
├── run-phase3.js                      # Script to run Phase 3
├── run-phase4.js                      # Script to run Phase 4
├── setup.js                           # Setup script for the project
├── start-server.js                    # Script to start the test server
├── testing_guide.md                   # Guide for testing
├── test_image.png                     # Test image file
├── TROUBLESHOOTING-UPDATED.md         # Updated troubleshooting guide
└── TROUBLESHOOTING.md                 # Original troubleshooting guide
```

## Source Code (`src/`)

The source code is organized into phases representing the progression of the implementation:

```
src/
├── phase1/                           # Basic visual testing implementation
│   ├── compare.js                    # Visual comparison logic
│   ├── create-visual-bug.js          # Script to create visual bugs
│   ├── original-styles.css           # Original CSS styles for reference
│   ├── README.md                     # Phase 1 documentation
│   ├── screenshot.js                 # Screenshot capture logic
│   └── workflow.js                   # Phase 1 workflow implementation
│
├── phase2/                           # AI-enhanced visual testing
│   ├── ai-report.js                  # AI reporting functionality
│   ├── ai-workflow.js                # AI workflow implementation
│   ├── ollama-client.js              # Ollama AI client integration
│   ├── README.md                     # Phase 2 documentation
│   └── visual-analyzer.js            # Visual analysis with AI
│
├── phase3/                           # Code analysis and issue localization
│   ├── code-analyzer.js              # Code analysis functionality
│   ├── code-recommendation.js        # Code recommendation generator
│   ├── FIXES.md                      # Documentation of fixes
│   ├── issue-localizer.js            # Issue localization functionality
│   ├── phase3-test.js                # Phase 3 test script
│   ├── phase3-workflow.js            # Phase 3 workflow implementation
│   ├── README.md                     # Phase 3 documentation
│   └── ui-code-mapper.js             # UI to code mapping functionality
│
├── phase4/                           # Self-healing implementation
│   ├── data/                         # Data directory for Phase 4
│   │   ├── .gitkeep                  # Git placeholder
│   │   └── knowledge_base.json       # Knowledge base of fixes
│   ├── fix-applier.js                # Fix application functionality
│   ├── fix-generator.js              # Fix generation with AI
│   ├── fix-verifier.js               # Fix verification functionality
│   ├── IMPLEMENTATION_SUMMARY.md     # Implementation summary
│   ├── README.md                     # Phase 4 documentation
│   ├── self-healing-workflow.js      # Self-healing workflow implementation
│   └── utils/                        # Utilities for Phase 4
│       ├── image-paths.js            # Image path utilities
│       └── line-matcher.js           # Line matching utilities
│
├── server.js                         # Test server implementation
│
└── utils/                            # Common utilities
    ├── config.js                     # Configuration utilities
    ├── logger.js                     # Logging functionality
    └── README.md                     # Utilities documentation
```

## Public Assets (`public/`)

Contains the test application files:

```
public/
├── css/                              # CSS directory
├── index.html                        # Main HTML file for test application
├── js/                               # JavaScript directory
├── script.js                         # Main script file
└── styles.css                        # Main stylesheet
```

## Screenshots (`screenshots/`)

Contains captured screenshots for testing:

```
screenshots/
├── baseline/                         # Baseline screenshots
│   ├── baseline-form.png             # Form component baseline
│   ├── baseline-full.png             # Full page baseline
│   ├── baseline-header.png           # Header component baseline
│   └── baseline-main.png             # Main content baseline
│
├── current/                          # Current screenshots (timestamped directories)
│   └── YYYY-MM-DDThh-mm-ss.sssZ/     # Timestamp directory
│       ├── current-form.png          # Current form component
│       ├── current-full.png          # Current full page
│       ├── current-header.png        # Current header component
│       └── current-main.png          # Current main content
│
├── diff/                             # Difference images (timestamped directories)
│   └── YYYY-MM-DDThh-mm-ss.sssZ/     # Timestamp directory
│       ├── diff-form.png             # Form difference visualization
│       ├── diff-full.png             # Full page difference visualization
│       ├── diff-header.png           # Header difference visualization
│       └── diff-main.png             # Main content difference visualization
│
└── verification/                     # Verification screenshots for fix testing
    ├── form.png                      # Form verification
    ├── full.png                      # Full page verification
    ├── header.png                    # Header verification
    └── main.png                      # Main content verification
```

## Reports (`reports/`)

Contains generated reports from test runs:

```
reports/
├── ai-visual-report-*.html           # AI-enhanced visual test reports
├── comparison-report-*.json          # JSON comparison result data
├── phase3-report-*.html              # Phase 3 (issue localization) reports
├── phase4-report-*.html              # Phase 4 (self-healing) reports
├── baseline-*                        # Copies of baseline images
├── current-*                         # Copies of current images
└── diff-*                            # Copies of diff images
```

## Backups (`backups/`)

Contains backups of files before modifications:

```
backups/
└── backup-YYYY-MM-DDThh-mm-ss.sssZ/  # Timestamped backup directory
    └── [original files]              # Original files before modification
```

## Logs (`logs/`)

Contains log files:

```
logs/
├── ai-visual-testing.log             # AI visual testing logs
├── phase3-workflow.log               # Phase 3 workflow logs
├── phase4-workflow.log               # Phase 4 workflow logs
└── server.log                        # Server logs
```

## Key Implementation Details

### Phase 1: Basic Visual Testing
- Screenshot capture
- Visual comparison
- Basic reporting

### Phase 2: AI-Enhanced Visual Testing
- AI analysis of visual differences
- Enhanced reporting with AI insights

### Phase 3: Code Analysis & Issue Localization
- Mapping UI elements to code
- Localizing visual issues in code
- Generating code recommendations

### Phase 4: Self-Healing Implementation
- AI-powered fix generation
- Fix application and verification
- Knowledge base of successful fixes

## Key Configuration Files

- `config.json`: Main configuration file with settings for screenshots, server, AI, etc.
- `package.json`: NPM package configuration with dependencies and scripts

## Running the Application

Key scripts for running the application:

- `npm run start-server`: Start the test server
- `npm run phase3`: Run Phase 3 (code analysis & issue localization)
- `npm run phase4`: Run Phase 4 (self-healing)
- `npm run fix-diff-images`: Fix diff image issues
- `npm run create-placeholder-diffs`: Create placeholder diff images
