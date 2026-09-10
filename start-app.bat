@echo off
REM ===================================================================
REM  Sentinel - start the web app
REM  Double-click this file, or run it from a terminal.
REM  Leave the window OPEN while you are using the app.
REM ===================================================================
title Sentinel - app server

echo.
echo  Starting Sentinel...
echo.

REM --- Is MySQL running? The app cannot do anything without it. --------
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo  [!] MySQL does not look like it is running.
    echo      Open the XAMPP Control Panel and press Start next to MySQL,
    echo      then run this file again.
    echo.
    pause
    exit /b 1
)
echo  [ok] MySQL is running.

REM --- Is something already on port 3000? ------------------------------
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo  [!] Port 3000 is already in use - the app may already be running.
    echo      Check your other terminal windows first.
    echo      To find the process:  netstat -ano ^| findstr :3000
    echo.
    pause
    exit /b 1
)
echo  [ok] Port 3000 is free.

REM --- Show the address to use from a phone on the same Wi-Fi ----------
echo.
echo  On this computer:  http://localhost:3000
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do echo  On your Wi-Fi:     http://%%b:3000
)
echo.
echo  (For a phone on mobile data or another network, run share-phone.bat too.)
echo.

cd /d "%~dp0Backend"
call npm.cmd start

REM --- The server has stopped. Keep the window open so the reason above -----
REM --- (an error, Ctrl+C, MySQL going away) can actually be read. ----------
echo.
echo  ===================================================================
echo   The server has STOPPED. The reason is printed above.
echo   Common causes: you pressed Ctrl+C, MySQL was stopped, port 3000
echo   was already in use, or the code threw an error.
echo  ===================================================================
echo.
pause
