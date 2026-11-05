@echo off
cd /d "%~dp0"
docker compose stop
if errorlevel 1 (echo Could not stop FlowPilot services. & exit /b 1)
echo Services stopped. Persistent data is preserved.
