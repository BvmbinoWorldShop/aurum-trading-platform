@echo off
title Aurum Mobile App
cd /d "%~dp0mobile"
echo Starting Expo Dev Server...
echo Scan the QR code with Expo Go on your phone or press 'w' for web browser.
npx expo start
pause
