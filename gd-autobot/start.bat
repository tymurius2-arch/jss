@echo off
rem Geometry Dash AutoBot: installs Geode + the bot mod and starts the game from Steam.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\launcher.ps1"
if errorlevel 1 (
  echo.
  echo Something went wrong, see the message above.
  pause
  exit /b 1
)
timeout /t 5 >nul
