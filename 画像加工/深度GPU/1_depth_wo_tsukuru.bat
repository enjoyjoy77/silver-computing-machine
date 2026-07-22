@echo off
setlocal
set VENV=%USERPROFILE%\.venvs\depth_gpu
if not exist "%VENV%\Scripts\python.exe" (
  echo Setting up... first time only, takes 10-20 min.
  python -m venv "%VENV%" || goto :err
  "%VENV%\Scripts\python.exe" -m pip install --upgrade pip || goto :err
  "%VENV%\Scripts\python.exe" -m pip install torch==2.4.1 torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cu121 || goto :err
  "%VENV%\Scripts\python.exe" -m pip install --no-deps xformers==0.0.27.post2 --index-url https://download.pytorch.org/whl/cu121 || goto :err
  "%VENV%\Scripts\python.exe" -m pip install --no-deps -r "%~dp0requirements_lock.txt" || goto :err
)
"%VENV%\Scripts\python.exe" "%~dp0depth_gpu.py" %*
exit /b %errorlevel%
:err
echo Setup failed. Ask Claude for help.
pause
exit /b 1
