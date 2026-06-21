@echo off
setlocal EnableDelayedExpansion

REM Always open in a dedicated window that stays open
if /i not "%~1"=="RUN" (
  start "AR STORE - Local Server" cmd /k "%~f0" RUN
  exit /b 0
)

title AR STORE - Local Server
cd /d "%~dp0server"

echo.
echo ========================================
echo   AR STORE - Local Server (live log)
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Download from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist "prisma\dev.db" (
  echo Creating database...
  call npm run db:push
  call npm run db:seed
)

REM Free port 3000 if another server is already running
set "OLD_PID="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do set "OLD_PID=%%a"
if defined OLD_PID (
  echo Stopping previous server on port 3000 ^(PID !OLD_PID!^)...
  taskkill /PID !OLD_PID! /F >nul 2>&1
  timeout /t 2 /nobreak >nul
)

REM Wi-Fi / LAN IP for phone access (prefer wireless adapter)
set "PHONE_IP="
for /f "delims=" %%i in ('powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.)' } | Sort-Object { if ($_.InterfaceAlias -match 'Wi-?Fi|WLAN|sans fil|Wireless') { 0 } else { 1 } } | Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { $ip }"') do set "PHONE_IP=%%i"

REM Allow inbound port 3000 on private networks (phone on same Wi-Fi)
netsh advfirewall firewall show rule name="AR Store Port 3000" >nul 2>&1
if errorlevel 1 (
  echo Setting up phone access ^(firewall port 3000^)...
  netsh advfirewall firewall add rule name="AR Store Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul 2>&1
  if errorlevel 1 (
    echo [WARN] Firewall rule not added. Run ALLOW-PHONE-ACCESS.bat as administrator.
  ) else (
    echo [OK] Firewall allows phone access on port 3000.
  )
)

echo.
echo   PC:     http://localhost:3000
if defined PHONE_IP (
  echo   Phone:  http://!PHONE_IP!:3000  ^(same Wi-Fi, not mobile data^)
  echo   Admin:  http://!PHONE_IP!:3000/admin/
) else (
  echo   Phone:  ^(no Wi-Fi IP found — check ipconfig^)
  echo   Admin:  http://localhost:3000/admin/
)
echo.
echo   Type the Phone URL exactly on your phone browser.
echo   Do NOT use localhost or 192.168.x.x on the phone.
echo.
echo   All updates appear below. Keep this window open.
echo   Press Ctrl+C to stop the server.
echo.
echo ========================================
echo.

timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"

call npm run dev
set "EXIT_CODE=!ERRORLEVEL!"

echo.
if !EXIT_CODE! neq 0 (
  echo [ERROR] Server stopped ^(code !EXIT_CODE!^).
  echo Common fix: close other terminals using port 3000, then run again.
) else (
  echo Server stopped.
)
echo.
pause
exit /b !EXIT_CODE!
