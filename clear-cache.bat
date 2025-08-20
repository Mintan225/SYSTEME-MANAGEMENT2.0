@echo off
echo Nettoyage des caches...

echo.
echo 1. Arrêt des processus Node.js...
taskkill /f /im node.exe 2>nul
timeout /t 2 >nul

echo.
echo 2. Nettoyage du cache npm...
cd client
call npm cache clean --force

echo.
echo 3. Suppression des node_modules/.cache...
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

echo.
echo 4. Reconstruction...
call npm run build

echo.
echo 5. Cache nettoyé ! Redémarrez votre serveur de développement.
echo.
pause
