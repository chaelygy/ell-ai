@echo off
title ELL_AI FACE - Biometric System Launcher
color 0A
cd /d "%~dp0"
python launcher.py
if errorlevel 1 pause
