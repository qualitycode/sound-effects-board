@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Make-Return-Zip.ps1"
if errorlevel 1 echo ZIP creation failed. See the message above.
pause
