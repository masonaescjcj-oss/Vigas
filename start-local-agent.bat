@echo off
echo ==============================================
echo 🚀 Starting Local Agent Server and Worker
echo ==============================================
echo.

:: Start Local API Server in a new window
start "Local API Server" cmd /c "npx deno run --allow-all --env local-api-server.ts && pause"

:: Start Local Queue Worker in a new window
start "Local Queue Worker" cmd /c "npx deno run --allow-all --env run-local-worker.ts && pause"

echo Local API Server running on port 54321
echo Local Queue Worker is polling for jobs...
echo.
echo You can now use the frontend app.
