@echo off
REM ===================================================================
REM  Sentinel - share the app with a phone, anywhere
REM
REM  Creates a temporary public https:// address that reaches the app
REM  running on this computer. Works on mobile data and other networks.
REM
REM  Run start-app.bat FIRST, and leave both windows open.
REM ===================================================================
title Sentinel - phone link

echo.
echo  Creating a public link to the app...
echo.

REM --- The app has to be running or the link points at nothing ---------
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if errorlevel 1 goto :noapp
echo  [ok] The app is running.

REM --- Find cloudflared.
REM     NOTE: these paths are written out in full on purpose. Using
REM     %ProgramFiles(x86)% here breaks cmd parsing, because the (x86)
REM     brackets are read as block brackets. Same reason the checks below
REM     use goto instead of if/else blocks.
set "CF="
if exist "C:\Program Files\cloudflared\cloudflared.exe" set "CF=C:\Program Files\cloudflared\cloudflared.exe"
if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not defined CF goto :nocloudflared

echo.
echo  Look for a line like:
echo      https://something-random.trycloudflare.com
echo  That is the address to open on the phone. It changes every time.
echo.
echo  Keep this window open. Closing it turns the link off.
echo.

"%CF%" tunnel --url http://localhost:3000
goto :eof

:noapp
echo  [!] The app is not running.
echo      Run start-app.bat first, wait for "Server is running",
echo      then run this file.
echo.
pause
exit /b 1

:nocloudflared
echo  [!] cloudflared is not installed. Install it once with:
echo      winget install --id Cloudflare.cloudflared
echo.
pause
exit /b 1
