@echo off
REM Wrapper so Task Scheduler can run the stable named-tunnel health keeper
powershell -NoProfile -ExecutionPolicy Bypass -File C:\cloudflared\ensure-artillery-health.ps1
