@echo off
cd /d "%~dp0.."
if exist "app\.venv\Scripts\python.exe" ("app\.venv\Scripts\python.exe" -m app.run_cycle) else (python -m app.run_cycle)
exit /b %errorlevel%
