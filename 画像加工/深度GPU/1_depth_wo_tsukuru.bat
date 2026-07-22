@echo off
setlocal
set VENV=%USERPROFILE%\.venvs\depth_gpu
if not exist "%VENV%\Scripts\python.exe" (
  echo Setting up... first time only, takes 10-20 min.
  python -m venv "%VENV%" || goto :err
  "%VENV%\Scripts\python.exe" -m pip install --upgrade pip || goto :err
  "%VENV%\Scripts\python.exe" -m pip install torch==2.4.0 torchvision==0.19.0 xformers==0.0.27.post2 --index-url https://download.pytorch.org/whl/cu121 || goto :err
  "%VENV%\Scripts\python.exe" -m pip install depth-anything-3 || goto :err
)
"%VENV%\Scripts\python.exe" "%~dp0depth_gpu.py" %*
exit /b %errorlevel%
:err
echo Setup failed. Ask Claude for help.
pause
exit /b 1
