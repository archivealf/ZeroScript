:: SPDX-License-Identifier: GPL-3.0-or-later
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

if exist "%~dp0start.py" (
    where py >nul 2>nul
    if not errorlevel 1 (
        py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
        if not errorlevel 1 (
            py -3 "%~dp0start.py" %*
            exit /b %errorlevel%
        )
    )
    where python3 >nul 2>nul
    if not errorlevel 1 (
        python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul && (
            python3 "%~dp0start.py" %*
            exit /b %errorlevel%
        )
    )
    where python >nul 2>nul
    if not errorlevel 1 (
        python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul && (
            python "%~dp0start.py" %*
            exit /b %errorlevel%
        )
    )
)

echo   ERROR: Python 3.9+ not found. Install Python 3.9 or newer and rerun start.py.
echo   If Python is installed, ensure python.exe is on PATH.
pause
exit /b 1
