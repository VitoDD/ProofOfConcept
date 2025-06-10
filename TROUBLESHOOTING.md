# AI Visual Testing Proof of Concept - Troubleshooting Guide

This document provides solutions to common issues encountered in the Phase 3 implementation of the AI Visual Testing Proof of Concept.

## Common Issues and Solutions

### 1. Server Connection Refused

**Symptoms:**
- Error: "Connection refused" when running the Phase 3 workflow
- UI-Code mapper fails to connect to the test server

**Solutions:**
- Start the server explicitly before running the tests:
  ```bash
  npm run start-server
  ```
  This will start the server in a separate process that stays running
  
- In a new terminal window, run your Phase 3 workflow:
  ```bash
  npm run phase3-test
  # or
  npm run phase3
  ```

- Make sure the port (default: 3000) is not already in use by another application

### 2. Missing Directories

**Symptoms:**
- Error about missing files or directories
- "ENOENT: no such file or directory" errors

**Solutions:**
- The workflow script now automatically creates required directories
- You can also manually create these directories:
  ```bash
  mkdir -p screenshots/baseline screenshots/current screenshots/diff reports logs
  ```

### 3. AI Analysis Timeout

**Symptoms:**
- "Timeout waiting for AI response" error
- Missing recommendations in the report

**Solutions:**
- The code now includes better timeout handling and fallback mechanisms
- If AI services (Ollama) are not responding, ensure they are running correctly
- If you don't need AI analysis, you can run with the `--skip-ai` flag:
  ```bash
  npm run phase3 -- --skip-ai
  ```

### 4. Diff Image Analysis Failures

**Symptoms:**
- "Failed to parse diff image" errors
- No localized issues found despite visible differences

**Solutions:**
- The diff analyzer now has better error handling and fallback mechanisms
- Check if the diff images are being generated correctly in the `screenshots/diff` directory
- Try recreating the baseline images:
  ```bash
  npm run phase3-baseline
  ```

### 5. Code Analysis Issues

**Symptoms:**
- Few or no code components found
- "No files found in..." warning

**Solutions:**
- Make sure the code to be analyzed is in the correct location (default: `./public`)
- Check if the directory path in `config.json` is correct
- The analyzer now provides more detailed error messages to help troubleshoot

## Running the Tests Step by Step

For a clean test run, follow these steps:

1. Start the test server:
   ```bash
   npm run start-server
   ```

2. In a new terminal, create baseline screenshots:
   ```bash
   npm run phase3-baseline
   ```

3. Introduce a test bug:
   ```bash
   npm run phase3-bug
   ```

4. Test the individual Phase 3 components:
   ```bash
   npm run phase3-test
   ```

## Logs and Reports

- Check the following log files for detailed error information:
  - `logs/phase3-workflow.log`
  - `logs/phase3-test.log`
  - `logs/server.log`

- HTML reports are generated in the `reports` directory

## Need More Help?

If you encounter issues not covered in this guide, please check the source code comments and the original documentation in:
- `src/phase3/README.md`
- `src/phase3/FIXES.md`
