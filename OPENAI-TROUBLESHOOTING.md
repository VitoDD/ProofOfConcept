# Troubleshooting OpenAI Integration

If you encounter issues with the OpenAI integration, here are some common problems and solutions:

## API Key Issues

### Problem: "OpenAI API key not found"
- Make sure you've set up your API key in one of the supported ways:
  1. Command line: `--api-key=your-api-key`
  2. Environment variable: `OPENAI_API_KEY=your-api-key`
  3. `.env` file with `OPENAI_API_KEY=your-api-key`

### Problem: "Error checking OpenAI status: AuthenticationError"
- Your API key may be invalid or expired
- Verify you're using the correct key in your OpenAI account

## Module Not Found Errors

### Problem: "Cannot find module './src/phase3/ai-client'"
- This can happen if you're running an older version of the project
- Run `npm run check-openai` to verify the OpenAI integration is correctly installed
- Make sure all the OpenAI files are present in the correct directories

## Permission Errors

### Problem: Access denied when writing reports or images
- Make sure you have write permissions to the project directories
- Try running the commands with administrator privileges if needed

## Performance Issues

### Problem: OpenAI requests are slow or timing out
- OpenAI API can sometimes be slow during high traffic periods
- Try increasing the timeout values in the code if needed
- Consider using a different OpenAI model (you can modify the `MODEL_MAPPING` in `openai-client.js`)

## Model-Specific Issues

### Problem: "Error: That model is currently overloaded with other requests"
- This is a temporary issue from OpenAI's side
- Wait a few minutes and try again
- Consider using a different model (e.g., switching from GPT-4o to GPT-4o-mini)

## Reporting Issues

If you continue to have problems, please gather the following information:
1. The full error message and stack trace
2. The version of Node.js you're using
3. The OpenAI model you're trying to use
4. Any changes you've made to the code

With this information, we can better diagnose and solve your specific issue.
