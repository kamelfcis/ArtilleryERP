@echo off
REM Wrapper so Task Scheduler / PM2 hooks can run the ensure script
powershell -NoProfile -ExecutionPolicy Bypass -File C:\cloudflared\ensure-artillery-tunnel.ps1
