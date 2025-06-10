# GitHub Actions Configuration Guide

This document explains how to set up GitHub Actions for the AI Visual Testing project to enable automated testing and PR creation with self-healing fixes.

## Prerequisites

- A GitHub repository containing the AI Visual Testing project
- Admin access to the repository to configure secrets
- (Optional) Permission to create Personal Access Tokens for your GitHub account

## Setting Up GitHub Secrets

For the GitHub Actions workflow to create pull requests with fixes, you need to configure secrets:

1. Navigate to your GitHub repository.
2. Click on the "Settings" tab.
3. In the left sidebar, click on "Secrets and variables" > "Actions".
4. Click "New repository secret".
5. Add the following secrets:

### `GITHUB_TOKEN`

This is automatically provided by GitHub for every workflow run. It typically has sufficient permissions for most operations, but may have some limitations for cross-repository actions.

### `PAT` (Personal Access Token)

A Personal Access Token with the `repo` scope provides more permissions than the default `GITHUB_TOKEN` and allows for cross-repository operations.

To create and add a PAT:

1. Go to [GitHub Personal Access Tokens settings](https://github.com/settings/tokens)
2. Click "Generate New Token" > "Generate New Token (classic)"
3. Give it a descriptive name, e.g., "AI Visual Testing Automation"
4. Select the `repo` scope (this gives full control of repositories)
5. Click "Generate token"
6. Copy the token (you will only see it once!)
7. Add it as a secret in your repository with the name `PAT`

### `OPENAI_API_KEY` (for OpenAI workflows)

For the OpenAI workflows, you need to provide your OpenAI API key:

1. Get your OpenAI API key from the [OpenAI platform](https://platform.openai.com/api-keys)
2. Add it as a secret in your repository with the name `OPENAI_API_KEY`

## Workflow Configuration

### Standard Workflow (Ollama)

The standard GitHub Actions workflow is configured in `.github/workflows/visual-testing.yml`. Key components:

1. **Trigger conditions**: The workflow runs on pushes to `main` and `develop` branches, and on pull requests to these branches.

2. **Environment setup**: Sets up Node.js, installs dependencies, and prepares Ollama.

3. **Visual testing**: Captures baseline screenshots and runs the visual testing workflow.

4. **Artifact upload**: Uploads test reports as workflow artifacts for review.

5. **Automated PR creation**: If the self-healing process generates fixes, it creates a pull request with these fixes.

### OpenAI Workflow

The OpenAI workflow is configured in `.github/workflows/openai-visual-testing-workflow.yml`. This workflow:

1. **Manual triggering only**: To control API costs, the OpenAI workflow runs only when manually triggered.

2. **Phase selection**: You can choose which phase to run (1, 2, 3, 4, or all).

3. **OpenAI API integration**: Uses the OpenAI API key from secrets for enhanced visual analysis.

4. **Separate reports**: Generates OpenAI-specific reports for comparison with Ollama results.

## Running the OpenAI Workflow

To run the OpenAI workflow:

1. Go to the "Actions" tab in your repository
2. Select "OpenAI Visual Testing Workflow" from the left sidebar
3. Click "Run workflow"
4. Choose which phase to run from the dropdown menu
5. Click "Run workflow" to start the process

## Self-Hosted Runner Configuration

There are two versions of each workflow:
- Standard: Runs on GitHub-hosted Ubuntu runners
- Self-hosted: Runs on your own Windows runners

To use a self-hosted runner:
1. Set up a self-hosted runner by following [GitHub's documentation](https://docs.github.com/en/actions/hosting-your-own-runners)
2. Use the corresponding self-hosted workflow file (ending with `-self-hosted.yml`)

## Customizing the Workflow

You can customize the workflows by editing the respective YAML files:

- Change the trigger conditions (e.g., add more branches)
- Modify the Node.js version
- Adjust labels applied to generated PRs
- Change PR naming and descriptions

## Troubleshooting

If your workflow fails, check:

1. **Permissions**: Ensure the `PAT` has the `repo` scope.
2. **Workflow logs**: Check for errors in the specific step that failed.
3. **OpenAI API key**: For OpenAI workflows, verify the API key is valid and has sufficient credits.
4. **Branch protection**: If you have branch protection rules, ensure the token has sufficient permissions to bypass them if necessary.

## Additional Resources

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Creating encrypted secrets for a repository](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [create-pull-request action documentation](https://github.com/peter-evans/create-pull-request)
- [OpenAI API documentation](https://platform.openai.com/docs/api-reference)
