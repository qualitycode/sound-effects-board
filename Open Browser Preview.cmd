@echo off
cd /d "%~dp0"
python browser\serve.py
if errorlevel 1 echo Preview did not start. Read the error above. Close an existing preview window if port 8765 is already in use.
pause
