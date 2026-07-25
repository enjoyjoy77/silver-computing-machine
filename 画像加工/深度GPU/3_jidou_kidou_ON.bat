@echo off
setlocal
rem Make ASCII junction to this folder (Japanese path safe)
if exist "%USERPROFILE%\depth_gpu_j" rmdir "%USERPROFILE%\depth_gpu_j"
mklink /J "%USERPROFILE%\depth_gpu_j" "%~dp0." >nul || goto :err
rem Copy silent launcher into Startup folder
copy /y "%~dp0autostart_gpu_server.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\gpu_depth_server.vbs" >nul || goto :err
rem Start it now (silent)
wscript "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\gpu_depth_server.vbs"
echo ON: GPU server ga Windows to issho ni jidou kidou shimasu.
echo (ima sugu ni mo ura de ugoki hajimemashita)
pause
exit /b 0
:err
echo Setup failed. Ask Claude for help.
pause
exit /b 1
