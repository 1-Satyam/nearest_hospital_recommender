@echo off
echo ========================================================
echo  Launching Nearest Hospital Recommender (BBSR)
echo ========================================================
echo.
echo Starting FastAPI Backend on Port 8000...
start cmd /k "python -m uvicorn backend.main:app --reload --port 8000"
timeout /t 3 /nobreak > nul
echo.
echo Starting React Vite Frontend on Port 3000...
cd frontend
start cmd /k "npm run dev"
echo.
echo Application launched!
echo Backend Docs: http://localhost:8000/docs
echo Frontend Web: http://localhost:3000
pause
