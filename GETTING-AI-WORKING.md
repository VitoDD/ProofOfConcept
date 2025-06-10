# Getting AI Analysis Working with Ollama and LLaVA

This guide helps you set up and troubleshoot the AI analysis in Phase 2 of the visual testing process.

## Prerequisites

1. **Install Ollama**:
   - Download from [https://ollama.com/](https://ollama.com/)
   - Follow installation instructions for your OS

2. **Download the LLaVA model**:
   ```bash
   ollama pull llava
   ```

3. **Download LLama model** (for text analysis):
   ```bash
   ollama pull llama3.2
   ```

## Step-by-Step Setup

1. **Start Ollama**:
   ```bash
   ollama serve
   ```
   Leave this terminal window open.

2. **Verify Ollama is running**:
   In a new terminal, run:
   ```bash
   npm run check-ollama
   ```
   You should see a success message with the available models.

3. **Generate test images**:
   ```bash
   npm run phase1
   ```
   This will introduce visual bugs and generate comparison reports.

4. **Test the AI analysis directly**:
   ```bash
   npm run test-ai
   ```
   This will analyze the most recent diff image with Ollama and show the results.

5. **Run the full Phase 2**:
   ```bash
   npm run phase2
   ```
   This will run the complete AI-enhanced visual testing workflow.

## Troubleshooting

### "Ollama is not available" error:
- Make sure Ollama is running (`ollama serve`)
- Check if Ollama is accessible at http://localhost:11434
- Try restarting Ollama

### "LLaVA model not found" error:
- Run `ollama pull llava` to download the model
- Verify models with `ollama list`

### "Connection timeout" error:
- Ollama might be processing a request. Try again later.
- Try restarting Ollama

### Phase 2 runs but no AI analysis in reports:
- Check logs for errors
- Run `npm run test-ai` to directly test the AI analysis
- Make sure the `--skip-ai` flag is not being used

### AI analysis is low quality:
- LLaVA might be overwhelmed by the image complexity
- Try with a simpler visual bug (run `npm run phase1-bug` with just one bug type)
- Ensure your system has enough RAM for the models (8GB+ recommended)

## Advanced: Using LLaVA-2 Instead

If you have access to LLaVA-2 or want to use a different model:

1. Download the model:
   ```bash
   ollama pull llava2
   ```

2. Edit config.json to use the new model:
   ```json
   {
     "ai": {
       "visualModel": "llava2"
     }
   }
   ```

3. Run the test:
   ```bash
   npm run phase2
   ```

## Verifying the AI Integration

If you want to verify that the AI integration is working:

1. Run the direct test:
   ```bash
   npm run test-ai
   ```

2. Check the generated file in the reports directory with the AI analysis results.

3. Look for specific identification of the bug types we introduced:
   - Text truncation
   - Missing elements
   - Color contrast issues
   - Layout shifts
