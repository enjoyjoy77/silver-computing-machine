@echo off
setlocal
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\gpu_depth_server.vbs" 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8977 ^| findstr LISTENING') do taskkill /f /pid %%p >nul 2>nul
echo OFF: jidou kidou wo yamete, server mo tomemashita.
pause
