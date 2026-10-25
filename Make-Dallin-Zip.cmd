@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\make-dallin-zip.ps1"
if errorlevel 1 echo ZIP creation failed. See the message above.
pause
