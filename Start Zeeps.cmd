@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Install Node.js LTS from https://nodejs.org/en/download first.
    echo Then close this window and double-click Start Zeeps.cmd again.
    pause
    exit /b 1
)
node scripts\start.js
if errorlevel 1 pause
