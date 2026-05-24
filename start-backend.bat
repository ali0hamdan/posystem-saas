@echo off
title Stock POS - Backend Server
cd /d "%~dp0backend"
echo Building backend...
call npm run build
if %errorlevel% neq 0 (
  echo BUILD FAILED. See errors above.
  pause
  exit /b 1
)
echo Starting backend on http://localhost:3000
node dist/main.js
pause
