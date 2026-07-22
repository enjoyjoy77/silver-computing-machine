@echo off
setlocal
set VENV=%USERPROFILE%\.venvs\depth_gpu
if not exist "%VENV%\Scripts\python.exe" (
  echo Run 1_depth_wo_tsukuru.bat first to set up.
  pause
  exit /b 1
)
"%VENV%\Scripts\python.exe" "%~dp0server.py"
pause
