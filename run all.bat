@echo off
setlocal

set "ROOT=%~dp0"
set "MVN_CMD=mvn"
set "MAVEN_VERSION=3.9.11"
set "MAVEN_HOME=%LOCALAPPDATA%\BadyaSportBooking\maven\apache-maven-%MAVEN_VERSION%"
set "MAVEN_BIN=%MAVEN_HOME%\bin\mvn.cmd"

echo =============================================
echo   Badya Sport Booking - Run All (Spring Boot)
echo =============================================

echo [1/8] Checking required tools...
where node >nul 2>nul
if errorlevel 1 goto :missing_node

where npm >nul 2>nul
if errorlevel 1 goto :missing_npm

where mvn >nul 2>nul
if errorlevel 1 (
	echo - Maven not found in PATH. Preparing portable Maven %MAVEN_VERSION%...
	call :ensure_maven
	if errorlevel 1 goto :missing_maven
) else (
	echo - Maven found in PATH.
)

echo [2/8] Ensuring dependencies are installed...
echo - Checking Backend dependencies...
if exist "%ROOT%node_modules" goto :backend_deps_done
pushd "%ROOT%"
call npm install
if errorlevel 1 goto :npm_install_failed
popd
:backend_deps_done

echo - Checking Frontend dependencies...
if exist "%ROOT%frontend\node_modules" goto :frontend_deps_done
pushd "%ROOT%frontend"
call npm install
if errorlevel 1 goto :npm_install_failed
popd
:frontend_deps_done

echo [3/8] Setting up Database (Prisma)...
pushd "%ROOT%"
echo - Generating Prisma Client...
call npx prisma generate
echo - Ensuring database is up to date...
echo - Pushing Prisma schema to database and seeding...
call npx prisma db push
echo - Healing database constraints...
call npx ts-node fix_db.ts
call npm run prisma:seed
echo - Starting Prisma Studio to view the database in a browser...
start "Prisma Studio" /D "%ROOT%" cmd /k "node studio.js"
popd

echo [4/8] Freeing up required ports...
call :free_port 8080 Backend
call :free_port 5173 Frontend
call :free_port 3333 Chatbot

echo [5/8] Starting Spring Boot Backend on port 8080...
start "Badya Backend" /D "%ROOT%backend" cmd /k "%MVN_CMD% spring-boot:run"

echo Waiting for backend to become ready on port 8080...
call :wait_for_port 8080 Backend

echo [6/8] Starting Chatbot Service on port 3333...
start "Badya Chatbot" /D "%ROOT%chatbot" cmd /k "node server.js"

echo [7/8] Starting React Frontend on port 5173...
start "Badya Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

echo [8/8] Finalizing launch...

echo Opening browser at http://localhost:5173 ...
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Done. Three windows were opened:
echo - Badya Backend (Spring Boot)
echo - Badya Chatbot (Node.js)
echo - Badya Frontend (React/Vite)
echo.
echo To stop, close those terminal windows.
goto :eof

:free_port
set "PORT=%~1"
set "SERVICE=%~2"
set "PID_TO_KILL="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
	set "PID_TO_KILL=%%P"
	goto :kill_pid
)
echo - %SERVICE% port %PORT% is free.
goto :eof

:kill_pid
echo - %SERVICE% port %PORT% is in use by PID %PID_TO_KILL%, stopping it...
taskkill /F /PID %PID_TO_KILL% >nul 2>nul
if errorlevel 1 (
	echo   WARNING: Could not stop PID %PID_TO_KILL%.
) else (
	echo   Stopped PID %PID_TO_KILL%.
)
goto :eof

:wait_for_port
set "PORT=%~1"
set "SERVICE=%~2"
for /l %%I in (1,1,60) do (
	powershell -NoProfile -Command "if (Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet) { exit 0 } else { exit 1 }" >nul 2>nul
	if not errorlevel 1 (
		echo - %SERVICE% port %PORT% is ready.
		goto :eof
	)
	timeout /t 1 /nobreak >nul
)
echo   WARNING: %SERVICE% did not become ready on port %PORT% within 60 seconds.
goto :eof

:ensure_maven
if exist "%MAVEN_BIN%" (
	set "MVN_CMD=%MAVEN_BIN%"
	echo   Using cached Maven at "%MAVEN_HOME%".
	exit /b 0
)

set "MAVEN_PARENT=%LOCALAPPDATA%\BadyaSportBooking\maven"
if not exist "%MAVEN_PARENT%" mkdir "%MAVEN_PARENT%"

set "MAVEN_ZIP=%MAVEN_PARENT%\apache-maven-%MAVEN_VERSION%-bin.zip"
set "MAVEN_URL=https://archive.apache.org/dist/maven/maven-3/%MAVEN_VERSION%/binaries/apache-maven-%MAVEN_VERSION%-bin.zip"

echo   Downloading Maven from Apache archive...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%MAVEN_URL%' -OutFile '%MAVEN_ZIP%' -UseBasicParsing"
if errorlevel 1 (
	echo   ERROR: Maven download failed.
	exit /b 1
)

echo   Extracting Maven...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%MAVEN_ZIP%' -DestinationPath '%MAVEN_PARENT%' -Force"
if errorlevel 1 (
	echo   ERROR: Maven extraction failed.
	exit /b 1
)

if not exist "%MAVEN_BIN%" (
	echo   ERROR: Maven installation is incomplete.
	exit /b 1
)

set "MVN_CMD=%MAVEN_BIN%"
echo   Maven installed successfully at "%MAVEN_HOME%".
exit /b 0

:missing_node
echo ERROR: Node.js is not available in PATH.
pause
exit /b 1

:missing_npm
echo ERROR: npm is not available in PATH.
pause
exit /b 1

:missing_maven
echo ERROR: Maven is required and could not be prepared automatically.
echo Install Maven manually from https://maven.apache.org/download.cgi and try again.
pause
exit /b 1

:npm_install_failed
echo ERROR: npm install failed.
popd
pause
exit /b 1
