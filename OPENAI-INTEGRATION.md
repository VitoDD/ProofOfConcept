# OpenAI Integration for AI Visual Testing

This extension adds OpenAI support to the existing AI-powered visual testing proof of concept. You can now choose between using local Ollama models (llama3.2 and llava) or cloud-based OpenAI models (GPT-4o-mini and GPT-4o Vision).

## Setup

### 1. Install Dependencies

First, make sure you have all required dependencies:

```bash
npm install
```

### 2. Configure OpenAI API Key

You need to provide your OpenAI API key in one of the following ways:

1. **Command line argument**:
   ```bash
   npm run phase2-openai --api-key=your-api-key-here
   ```

2. **Environment variable**:
   ```bash
   export OPENAI_API_KEY=your-api-key-here
   npm run phase2-openai
   ```

3. **Environment file (.env)**:
   Create a `.env` file in the project root with the following content:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

## Using OpenAI for Visual Testing

The project now provides OpenAI versions of all four phases:

### Phase 1: Basic Visual Testing

```bash
npm run phase1-openai           # Run phase 1 with OpenAI config
npm run phase1-openai-baseline  # Capture baseline screenshots
npm run phase1-openai-bug       # Introduce a visual bug for testing
```

Note: Phase 1 doesn't actually use AI, but the OpenAI configuration is set up for consistency.

### Phase 2: AI-Enhanced Visual Testing

```bash
npm run phase2-openai           # Run phase 2 with OpenAI
npm run phase2-openai-baseline  # Capture baseline screenshots with OpenAI
npm run phase2-openai-bug       # Introduce a visual bug with OpenAI analysis
```

### Phase 3: Advanced Analysis

```bash
npm run phase3-openai           # Run phase 3 with OpenAI
npm run phase3-openai-baseline  # Capture baseline screenshots with OpenAI
npm run phase3-openai-bug       # Introduce a visual bug with OpenAI analysis
```

### Phase 4: Self-Healing

```bash
npm run phase4-openai           # Run phase 4 with OpenAI
npm run phase4-openai-baseline  # Capture baseline screenshots with OpenAI
npm run phase4-openai-bug       # Introduce a visual bug with OpenAI analysis
npm run phase4-openai-dry-run   # Run in dry-run mode (no changes applied)
```

### Run All Phases with OpenAI

To run all phases in sequence with OpenAI:

```bash
npm run run-all-openai
```

## Model Comparison

### Ollama (Local)
- **Text model**: llama3.2
- **Vision model**: llava
- **Analysis approach**: Uses all three images (baseline, current, and diff)
- **Benefits**: No API costs, full privacy, no data leaving your machine
- **Drawbacks**: Requires local resources, may be slower on less powerful machines

### OpenAI (Cloud)
- **Text model**: GPT-4o-mini
- **Vision model**: GPT-4o
- **Analysis approach**: Uses only baseline and current images (skips diff image)
- **Benefits**: Higher quality analysis, faster processing, no local setup needed
- **Drawbacks**: API costs, data sent to OpenAI, requires internet connection

> **Note**: The OpenAI integration can use various GPT models. By default, it uses GPT-4o-mini for text analysis and GPT-4o for image analysis, but these can be adjusted in the code if needed.

## Troubleshooting

- If you encounter issues with OpenAI API access, check that your API key is valid and has access to the required models.
- The OpenAI implementation requires an active internet connection to function.
- You can run `node check-openai.js` to verify OpenAI API access.
- For other issues, refer to the main README and troubleshooting documentation.

## Implementation Notes

The OpenAI integration was built to be minimally invasive to the existing codebase. It provides parallel implementations of the AI client and visual analyzer components, allowing you to switch between Ollama and OpenAI without changing the core functionality.
