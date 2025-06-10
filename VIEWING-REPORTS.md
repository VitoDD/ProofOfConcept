# Viewing Visual Testing Reports

There are two ways to properly view the visual testing reports:

## Option 1: Use the report server

Run the dedicated report server which will properly serve both the reports and the screenshot images:

```bash
npm run view-reports
```

Then open your browser to [http://localhost:3001/reports](http://localhost:3001/reports)

## Option 2: Use the main application server

If you need to view reports while the main application is running:

```bash
npm run start
```

Then access your reports at [http://localhost:3000/reports](http://localhost:3000/reports)

## Troubleshooting

If images are not showing up in the reports:

1. Make sure one of the servers is running (either main server or report server)
2. Check that screenshot files exist in the correct locations:
   - Baseline images: `./screenshots/baseline/`
   - Current images: `./screenshots/current/[timestamp]/`
   - Diff images: `./screenshots/diff/[timestamp]/`
3. If running Phase 1 for the first time, you may need to capture baselines first:
   ```bash
   npm run phase1-baseline
   ```
4. If the dimension mismatch error occurs, run the server and check the actual screenshots to compare the differences.
