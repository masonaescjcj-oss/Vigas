@echo off
echo ==============================================
echo Starting Retro Code local dev stack
echo ==============================================
echo.

:: Start Local API Server in a new window (port 54321)
start "Local API Server" cmd /c "npx deno run --allow-all --env-file=.env local-api-server.ts && pause"

:: Start Local Queue Worker in a new window
start "Local Queue Worker" cmd /c "npx deno run --allow-all --env-file=.env run-local-worker.ts && pause"

:: Start Expo Web in a new window (port 8081; app reads EXPO_PUBLIC_* from .env)
start "Expo Web" cmd /c "npx expo start --web && pause"

echo Local API Server  : http://localhost:54321
echo Queue Worker      : polling job_queue every 3s
echo Expo Web          : http://localhost:8081
echo.
echo All three windows must stay open while developing.
