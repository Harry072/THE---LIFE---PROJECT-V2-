@echo off
echo Starting The Life Project...
echo.

:: Start the FastAPI Backend in a new terminal window
:: This updated version ensures dependencies are always installed properly and uses python -m uvicorn to prevent PATH errors.
start "The Life Project - Backend" cmd /k "cd /d "%~dp0backend" && if not exist venv (echo Creating virtual environment... && python -m venv venv) && call venv\Scripts\activate && echo Checking dependencies... && venv\Scripts\python.exe -m pip install fastapi uvicorn supabase google-generativeai python-dotenv pydantic pyjwt && echo Starting backend server... && venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: Start the React/Vite Frontend in a new terminal window
start "The Life Project - Frontend" cmd /k "cd /d "%~dp0frontend" && echo Installing Node modules... && npm install && echo Starting frontend server... && npm run dev"

echo Both servers are booting up in separate windows!
echo You can close this window now.
pause