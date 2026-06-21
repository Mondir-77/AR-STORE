@echo off
setlocal EnableDelayedExpansion
title AR STORE - Allow phone on Wi-Fi

echo.
echo ========================================
echo   AR STORE - Phone access (port 3000)
echo ========================================
echo.
echo This adds a Windows Firewall rule so your phone
echo can open the site on the same Wi-Fi network.
echo.
echo Administrator permission is required (UAC prompt).
echo.

netsh advfirewall firewall show rule name="AR Store Port 3000" >nul 2>&1
if not errorlevel 1 (
  echo [OK] Firewall rule already exists.
  goto :showip
)

echo Adding firewall rule...
netsh advfirewall firewall add rule name="AR Store Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
if errorlevel 1 (
  echo.
  echo [ERROR] Could not add rule. Right-click this file and choose
  echo         "Run as administrator", then try again.
  echo.
  pause
  exit /b 1
)

echo [OK] Firewall rule added.

:showip
set "PHONE_IP="
for /f "delims=" %%i in ('powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.)' } | Sort-Object { if ($_.InterfaceAlias -match 'Wi-?Fi|WLAN|sans fil|Wireless') { 0 } else { 1 } } | Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { $ip }"') do set "PHONE_IP=%%i"

echo.
if defined PHONE_IP (
  echo   Phone URL:  http://!PHONE_IP!:3000
  echo   Admin URL:  http://!PHONE_IP!:3000/admin/
) else (
  echo   Run START-SERVER.bat to see your phone URL.
)
echo.
echo   Phone must use Wi-Fi ^(not mobile data^), same network as this PC.
echo.
pause
