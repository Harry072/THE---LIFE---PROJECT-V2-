@echo off
echo Starting The Life Project...
echo.

:: Set portable Node.js v22 path
set "NODE_DIR=%~dp0node_portable_v22\node-v22.13.1-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

:: Start the FastAPI Backend in a new terminal window
start "The Life Project - Backend" cmd /k "cd /d "%~dp0backend" && if not exist venv (echo Creating virtual environment... && python -m venv venv) && call venv\Scripts\activate && echo Checking dependencies... && venv\Scripts\python.exe -m pip install -r requirements.txt -q && echo Starting backend server... && venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: Start the React/Vite Frontend in a new terminal window
start "The Life Project - Frontend" cmd /k "set PATH=%NODE_DIR%;%PATH% && cd /d "%~dp0frontend" && echo Installing Node modules... && "%NODE_DIR%\node.exe" "%NODE_DIR%\node_modules\npm\bin\npm-cli.js" install && echo Starting frontend server... && "%NODE_DIR%\node.exe" "%NODE_DIR%\node_modules\npm\bin\npm-cli.js" run dev"

echo Both servers are booting up in separate windows!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
echo You can close this window now.
pause
