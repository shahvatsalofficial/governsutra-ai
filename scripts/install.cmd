@echo off
node --version
if errorlevel 1 exit /b 1
npm test
if errorlevel 1 exit /b 1
npm run doctor
if errorlevel 1 exit /b 1
echo GovernSutra AI starter checks passed. No global installation was performed.
