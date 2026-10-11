@echo off
echo ==============================================
echo  Nearest Hospital Recommender - Local Setup
echo ==============================================
echo.
echo Installing Python dependencies...
pip install -r backend/requirements.txt
echo.
echo Running Backend Core Tests...
python backend/tests/test_core.py
pause
