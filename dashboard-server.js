const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const app = express();
const port = 3001; // Different from your main server port

// Serve static files
app.use(express.static('public'));
app.use('/reports', express.static('reports'));
app.use('/screenshots', express.static('screenshots'));

// Create API endpoints for status
app.get('/api/status', (req, res) => {
  try {
    // Check Ollama status
    let ollamaStatus = 'Stopped';
    try {
      const ollamaOutput = execSync('tasklist /FI "IMAGENAME eq ollama.exe" /FO CSV', { encoding: 'utf8' });
      ollamaStatus = ollamaOutput.includes('ollama.exe') ? 'Running' : 'Stopped';
    } catch (error) {
      console.error('Error checking Ollama status:', error);
    }

    // Check if server is running on port 3000
    let serverStatus = 'Stopped';
    try {
      const netstatOutput = execSync('netstat -ano | findstr :3000', { encoding: 'utf8' });
      serverStatus = netstatOutput.includes('LISTENING') ? 'Running' : 'Stopped';
    } catch (error) {
      console.error('Error checking server status:', error);
    }

    // Get available models
    let models = [];
    try {
      const modelsOutput = execSync('ollama list', { encoding: 'utf8' });
      models = modelsOutput
        .split('\n')
        .filter(line => line.trim().length > 0 && !line.includes('NAME'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return { name: parts[0], size: parts[1] };
        });
    } catch (error) {
      console.error('Error getting models:', error);
    }

    // Get latest reports
    const reportsDir = path.join(__dirname, 'reports');
    let reports = [];
    if (fs.existsSync(reportsDir)) {
      reports = fs.readdirSync(reportsDir)
        .filter(file => file.startsWith('phase4-report-') && file.endsWith('.html'))
        .sort((a, b) => {
          const statA = fs.statSync(path.join(reportsDir, a));
          const statB = fs.statSync(path.join(reportsDir, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        })
        .slice(0, 5)
        .map(file => {
          const stat = fs.statSync(path.join(reportsDir, file));
          return {
            name: file,
            date: stat.mtime.toISOString(),
            url: `/reports/${file}`
          };
        });
    }

    // Get system GPU status
    let gpuInfo = 'Unknown';
    try {
      const gpuOutput = execSync('nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader', { encoding: 'utf8' });
      gpuInfo = gpuOutput.trim();
    } catch (error) {
      console.error('Error getting GPU info:', error);
    }

    res.json({
      status: {
        ollama: ollamaStatus,
        server: serverStatus,
        gpu: gpuInfo
      },
      models,
      reports
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create API endpoint to run the local pipeline
app.post('/api/run-pipeline', (req, res) => {
  try {
    // Run the pipeline in a new process
    const child = execSync('start cmd /c run-local-pipeline.bat', { 
      stdio: 'ignore',
      windowsHide: true 
    });
    
    res.json({ success: true, message: 'Pipeline started successfully' });
  } catch (error) {
    console.error('Error starting pipeline:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create the HTML for the dashboard
app.get('/', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Visual Testing Dashboard</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        margin: 0;
        padding: 20px;
        background-color: #f7f9fc;
        color: #333;
      }
      .container {
        max-width: 1200px;
        margin: 0 auto;
      }
      h1 {
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 10px;
      }
      .dashboard {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      .card {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
      }
      .card h2 {
        margin-top: 0;
        color: #3498db;
        font-size: 1.2rem;
      }
      .status {
        margin-top: 15px;
      }
      .status-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
      }
      .status-label {
        font-weight: 500;
      }
      .status-value {
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.9rem;
      }
      .running {
        background-color: #2ecc71;
        color: white;
      }
      .stopped {
        background-color: #e74c3c;
        color: white;
      }
      .unknown {
        background-color: #f39c12;
        color: white;
      }
      button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        margin-top: 10px;
        transition: background-color 0.2s;
      }
      button:hover {
        background-color: #2980b9;
      }
      .model-list, .report-list {
        margin-top: 15px;
      }
      .model-item, .report-item {
        padding: 10px;
        border-bottom: 1px solid #eee;
      }
      .model-item:last-child, .report-item:last-child {
        border-bottom: none;
      }
      .report-date {
        font-size: 0.8rem;
        color: #7f8c8d;
        margin-top: 5px;
      }
      a {
        color: #3498db;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .loading {
        text-align: center;
        padding: 20px;
        font-style: italic;
        color: #7f8c8d;
      }
      .refresh-btn {
        background-color: #2ecc71;
        margin-left: 10px;
      }
      .actions {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      .gpu-info {
        margin-top: 10px;
        padding: 10px;
        background-color: #f8f9fa;
        border-radius: 4px;
        font-family: monospace;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>AI Visual Testing Dashboard</h1>
      
      <div class="dashboard">
        <div class="card">
          <h2>System Status</h2>
          <div class="status" id="status-container">
            <div class="loading">Loading status...</div>
          </div>
          <div class="gpu-info" id="gpu-info">Loading GPU information...</div>
        </div>
        
        <div class="card">
          <h2>Available Models</h2>
          <div class="model-list" id="model-list">
            <div class="loading">Loading models...</div>
          </div>
        </div>
        
        <div class="card">
          <h2>Recent Reports</h2>
          <div class="report-list" id="report-list">
            <div class="loading">Loading reports...</div>
          </div>
        </div>
        
        <div class="card">
          <h2>Pipeline Actions</h2>
          <p>Run the AI visual testing pipeline with GPU acceleration on your local machine.</p>
          <button id="run-pipeline">Run Complete Pipeline</button>
          <p id="pipeline-status"></p>
        </div>
      </div>
      
      <div class="actions">
        <button id="refresh-data">Refresh Dashboard</button>
        <a href="http://localhost:3000/confirm.html" target="_blank">
          <button>Open Confirmation UI</button>
        </a>
      </div>
    </div>
    
    <script>
      // Fetch status data
      async function fetchStatus() {
        try {
          const response = await fetch('/api/status');
          const data = await response.json();
          
          // Update status section
          const statusContainer = document.getElementById('status-container');
          statusContainer.innerHTML = '';
          
          const statuses = [
            { label: 'Ollama Service', value: data.status.ollama },
            { label: 'Web Server', value: data.status.server }
          ];
          
          statuses.forEach(item => {
            const statusClass = item.value.toLowerCase() === 'running' ? 'running' : 
                              item.value.toLowerCase() === 'stopped' ? 'stopped' : 'unknown';
            
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            statusItem.innerHTML = \`
              <div class="status-label">\${item.label}</div>
              <div class="status-value \${statusClass}">\${item.value}</div>
            \`;
            statusContainer.appendChild(statusItem);
          });
          
          // Update GPU info
          const gpuInfo = document.getElementById('gpu-info');
          gpuInfo.textContent = data.status.gpu || 'GPU information not available';
          
          // Update models list
          const modelList = document.getElementById('model-list');
          modelList.innerHTML = '';
          
          if (data.models.length === 0) {
            modelList.innerHTML = '<div class="model-item">No models available</div>';
          } else {
            data.models.forEach(model => {
              const modelItem = document.createElement('div');
              modelItem.className = 'model-item';
              modelItem.textContent = \`\${model.name} (\${model.size})\`;
              modelList.appendChild(modelItem);
            });
          }
          
          // Update reports list
          const reportList = document.getElementById('report-list');
          reportList.innerHTML = '';
          
          if (data.reports.length === 0) {
            reportList.innerHTML = '<div class="report-item">No reports available</div>';
          } else {
            data.reports.forEach(report => {
              const reportItem = document.createElement('div');
              reportItem.className = 'report-item';
              
              const date = new Date(report.date);
              const formattedDate = date.toLocaleString();
              
              reportItem.innerHTML = \`
                <a href="\${report.url}" target="_blank">\${report.name}</a>
                <div class="report-date">\${formattedDate}</div>
              \`;
              reportList.appendChild(reportItem);
            });
          }
        } catch (error) {
          console.error('Error fetching status:', error);
        }
      }
      
      // Run the pipeline
      async function runPipeline() {
        const button = document.getElementById('run-pipeline');
        const status = document.getElementById('pipeline-status');
        
        button.disabled = true;
        status.textContent = 'Starting pipeline...';
        
        try {
          const response = await fetch('/api/run-pipeline', { method: 'POST' });
          const data = await response.json();
          
          if (data.success) {
            status.textContent = 'Pipeline running in background. Check the console window for progress.';
          } else {
            status.textContent = \`Error: \${data.error || 'Unknown error'}\`;
          }
        } catch (error) {
          status.textContent = \`Error: \${error.message || 'Failed to start pipeline'}\`;
          console.error('Error running pipeline:', error);
        } finally {
          setTimeout(() => {
            button.disabled = false;
          }, 5000);
        }
      }
      
      // Initial load
      fetchStatus();
      
      // Set up event listeners
      document.getElementById('refresh-data').addEventListener('click', fetchStatus);
      document.getElementById('run-pipeline').addEventListener('click', runPipeline);
      
      // Auto-refresh every 30 seconds
      setInterval(fetchStatus, 30000);
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Start the server
app.listen(port, () => {
  console.log(`Dashboard server running at http://localhost:${port}`);
});
