# GitHub Workflows Changes Summary

## 🎯 Changes Made: All Workflows Now Manual-Only

All workflows have been converted from automatic triggers to manual-only execution to save GitHub Actions minutes and prevent unnecessary runs.

## 📋 Updated Workflows

### 1. `visual-testing.yml` (GitHub Actions - Ubuntu)
- **Before**: Auto-ran on every push/PR to main/develop
- **After**: Manual-only with run type options
- **Options**: comprehensive, baseline-only, bug-test, revert-bugs

### 2. `ai-visual-testing-workflow.yml` (Self-Hosted)
- **Before**: Auto-ran on every push/PR to main/develop  
- **After**: Manual-only with run type options
- **Options**: comprehensive, baseline-only, bug-test, revert-bugs

### 3. `visual-confirmations.yml` (GitHub Actions - Ubuntu)
- **Before**: Auto-ran on every push/PR to main/develop
- **After**: Manual-only confirmation workflow
- **Options**: run-tests, approve, reject

### 4. `process-confirmations.yml` (GitHub Actions - Ubuntu)
- **Before**: Auto-ran every hour (24x/day)
- **After**: Manual-only (with optional daily schedule commented out)
- **Savings**: ~120 minutes/day of GitHub Actions usage

### 5. OpenAI Workflows (Already Manual)
- `openai-visual-testing-workflow.yml` - No changes needed
- `openai-visual-testing-workflow-self-hosted.yml` - No changes needed

## 💰 Cost Savings

**Previous Usage (Estimated)**:
- Daily pushes: 2 workflows × 30 min = 60 min/day
- Hourly confirmations: 24 runs × 5 min = 120 min/day
- **Total**: ~180+ minutes/day = ~5,400 minutes/month

**New Usage**:
- **0 minutes/day automatic**
- Only runs when manually triggered
- **Estimated 95%+ reduction in GitHub Actions usage**

## 🚀 How to Run Workflows Manually

### From GitHub Web Interface:
1. Go to your repository
2. Click "Actions" tab
3. Select the workflow you want
4. Click "Run workflow" button
5. Choose your options and click "Run workflow"

### Available Run Types:

#### For Visual Testing Workflows:
- **comprehensive**: Full test cycle (revert bugs → run tests → process confirmations)
- **baseline-only**: Just capture new baseline screenshots
- **bug-test**: Introduce bugs and test detection
- **revert-bugs**: Clean up any introduced test bugs

#### For Confirmation Workflow:
- **run-tests**: Execute visual tests and generate confirmations
- **approve**: Approve a specific confirmation by ID
- **reject**: Reject a specific confirmation by ID

#### For Process Confirmations:
- Choose environment: production, staging, or development

## 🔧 Optional: Re-enable Scheduled Runs

If you want to re-enable automatic confirmation processing (but daily instead of hourly), uncomment these lines in `process-confirmations.yml`:

```yaml
schedule:
  # Run once daily at 2 AM UTC instead of every hour
  - cron: '0 2 * * *'
```

## 📝 Workflow Selection Guide

**For Regular Development**:
- Use `visual-testing.yml` (GitHub Actions) for standard testing
- Use `comprehensive` run type for full testing

**For Local/Self-Hosted Testing**:
- Use `ai-visual-testing-workflow.yml` (Self-hosted)
- Better for development when you have Ollama locally

**For Cost-Sensitive Testing**:
- Use `openai-visual-testing-workflow.yml` manually
- Pay per API call instead of compute time

**For Confirmation Management**:
- Use `visual-confirmations.yml` for approval workflows
- Use `process-confirmations.yml` to apply approved changes

## ✅ Benefits of Manual-Only Approach

1. **Cost Control**: No surprise GitHub Actions usage
2. **Intentional Testing**: Run tests when you actually need them
3. **Resource Efficiency**: No wasted compute on unchanged code
4. **Better Debugging**: Full control over when and what to test
5. **Flexibility**: Choose the right workflow for each situation

## 🔄 Reverting Changes (If Needed)

If you want to restore automatic triggers for any workflow, simply add back:

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:
    # ... existing inputs
```

But we recommend keeping them manual to maintain cost control.
