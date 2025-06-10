@echo off
:: start-dashboard.bat - Start the dashboard server for local GPU-accelerated pipeline

echo Starting AI Visual Testing Dashboard...
start "" http://localhost:3001
node dashboard-server.js
