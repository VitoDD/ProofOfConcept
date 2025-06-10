@echo off
:: setup-self-hosted-runner.bat
:: This script helps set up a self-hosted GitHub Actions runner

echo ========================================
echo Self-Hosted GitHub Runner Setup
echo ========================================
echo.

:: Check if Ollama is installed
where ollama >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Ollama is not installed. Please download and install it from:
    echo https://ollama.com/download
    echo.
    echo After installation, run this script again.
    pause
    exit /b
)

:: Create runner directory
set RUNNER_DIR=%~dp0actions-runner
if not exist "%RUNNER_DIR%" mkdir "%RUNNER_DIR%"
cd "%RUNNER_DIR%"

:: Ask for GitHub repository URL and token
set /p REPO_URL=Enter your GitHub repository URL (e.g., https://github.com/username/ai-visual-testing-poc): 
set /p TOKEN=Enter your GitHub runner registration token: 

:: Download the runner package
echo.
echo Downloading GitHub Actions runner...
curl -o actions-runner-win-x64.zip -L https://github.com/actions/runner/releases/download/v2.324.0/actions-runner-win-x64-2.324.0.zip

:: Extract the installer
echo.
echo Extracting runner package...
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem ; [System.IO.Compression.ZipFile]::ExtractToDirectory('%CD%\actions-runner-win-x64.zip', '%CD%')"

:: Configure the runner
echo.
echo Configuring runner with your repository...
config.cmd --url %REPO_URL% --token %TOKEN% --name "GPU-Runner" --labels gpu,windows --work _work

:: Set up as a service
echo.
echo Installing runner as a service...
svc.cmd install
svc.cmd start

echo.
echo ========================================
echo Self-hosted runner setup completed!
echo ========================================
echo.
echo Your PC is now registered as a self-hosted runner with GPU support.
echo Check your GitHub repository's Actions tab to see if the runner is online.
echo.
echo Make sure Ollama is installed and running before triggering workflows.
echo.
pause
