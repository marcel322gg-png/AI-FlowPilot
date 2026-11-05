@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0RUNLOCALLY.ps1"
exit /b %errorlevel%
