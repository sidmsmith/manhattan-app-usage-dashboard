@echo off
cd /d "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"
echo.
echo === Checking Git Status ===
git status
echo.
echo === Staging All Changes ===
git add -A
echo.
echo === Committing Changes ===
git commit -m "v0.0.3: Update header card styles to match app cards, reverse event format (App bold || Event)"
echo.
echo === Recent Commits ===
git log --oneline -3
echo.
echo === Pushing to GitHub ===
git push origin main
echo.
echo === Final Status ===
git status
echo.
pause
