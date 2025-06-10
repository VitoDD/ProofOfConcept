# Phase 3: Code Analysis & Issue Localization

This phase connects visual differences to source code, identifying which code changes are responsible for visual issues and providing specific guidance for fixing them.

## Key Objectives

1. Create a mapping between UI elements and their corresponding source code
2. Analyze code structure to understand relationships between components
3. Pinpoint exact code locations responsible for visual differences
4. Generate developer-friendly recommendations for fixing issues
5. Enhance reporting with code context and fix suggestions

## Core Components

### Code-UI Mapping (`ui-code-mapper.js`)

- Creates relationships between visual elements and source code
- Analyzes HTML, CSS, and JavaScript to build element mappings
- Supports selector-based and attribute-based element identification
- Maintains a bidirectional map between DOM elements and code locations
### Code Analysis (`code-analyzer.js`)

- Static analysis of HTML, CSS, and JavaScript files
- Builds a structured representation of the codebase
- Identifies dependencies between components
- Creates a searchable index of code elements
- Supports incremental updates for efficient processing

### Issue Localization (`issue-localizer.js`)

- Identifies specific code responsible for visual differences
- Correlates AI-detected changes with code elements
- Prioritizes potential causes based on confidence scores
- Handles complex scenarios with multiple contributing factors
- Provides file paths, line numbers, and code snippets

### Code Recommendations (`code-recommendation.js`)

- Generates specific suggestions for fixing visual issues
- Uses AI to create human-readable explanations
- Provides code examples and potential solutions
- Considers best practices and coding standards
- Includes confidence ratings for recommendations
### Workflow Integration (`phase3-workflow.js`)

- Integrates Phase 1, 2, and 3 components into a unified workflow
- Handles command-line options and configuration
- Orchestrates the entire process from screenshot capture to recommendations
- Generates comprehensive reports with all collected information
- Provides extension points for Phase 4 integration

## Key Features

### Intelligent Code-UI Mapping

- DOM traversal for element identification
- CSS selector analysis for style mapping
- JavaScript event handler tracking
- Dynamic content generation detection
- Framework-specific component recognition

### Precise Issue Localization

- Multi-level search algorithm for finding code issues:
  1. Direct selector matching for exact element changes
  2. Parent/child relationship analysis for layout issues
  3. Global style impact assessment for widespread changes
  4. JavaScript interaction analysis for dynamic content
- Confidence scoring for multiple potential causes
### Developer-Friendly Recommendations

- Context-aware fix suggestions based on issue type
- Multiple solution options for complex problems
- Code snippets showing before/after examples
- Explanation of why the issue occurred
- Best practice recommendations

### Enhanced Reporting

- Interactive HTML reports with code context
- Side-by-side comparison of visual differences and code
- Highlighted code sections responsible for issues
- Collapsible sections for detailed information
- Direct links to affected files and line numbers

## Usage Instructions

### Basic Commands

```bash
# Run complete Phase 3 workflow
npm run phase3

# Capture baseline screenshots
npm run phase3-baseline

# Introduce a visual bug
npm run phase3-bug -- --bug-type=color

# Run without AI analysis (if Ollama is unavailable)
npm run phase3-no-ai

# Test specific components
npm run phase3-test
```
### Configuration Options

In addition to options from previous phases:
- `--code-path=PATH`: Specify path to code directory
- `--max-depth=NUMBER`: Set maximum search depth for code analysis
- `--recommendation-level=LEVEL`: Set detail level for recommendations (basic, detailed, extensive)
- `--fix-suggestions=BOOLEAN`: Enable/disable fix suggestions

## Implementation Details

### Code Analysis Approach

The code analyzer uses a multi-pass approach:
1. Initial parse of all HTML, CSS, and JavaScript files
2. Building of DOM tree and style rules representation
3. Resolution of dependencies between components
4. Creation of a searchable index for quick lookups
5. Incremental updates when files change

### Issue Localization Algorithm

1. Start with affected UI elements identified by AI analysis
2. Find corresponding selectors in CSS files
3. Check recent code changes in relevant files
4. Analyze parent/child relationships for layout issues
5. Evaluate JavaScript for dynamic content changes
6. Rank potential causes by confidence score

## Integration with Other Phases

- **Phase 1 & 2**: Provides visual difference detection and AI analysis
- **Phase 4**: Uses issue localization to enable self-healing capabilities

## Next Steps

Phase 4 will build on the issue localization capabilities to implement self-healing features that can automatically fix detected visual issues.
