@echo off
echo === NETTOYAGE COMPLET ET REDEMARRAGE ===

echo 1. Arrêt de tous les processus Node.js...
taskkill /f /im node.exe 2>nul
taskkill /f /im tsx.exe 2>nul
timeout /t 3 >nul

echo 2. Suppression des caches...
cd client
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"
if exist ".vite" rmdir /s /q ".vite"
if exist "dist" rmdir /s /q "dist"

echo 3. Nettoyage NPM...
call npm cache clean --force

echo 4. Build...
call npm run build

echo 5. Redémarrage du serveur...
cd ..
start "Server" cmd /k "npm run dev"

echo ✅ Serveur redémarré !
pause
