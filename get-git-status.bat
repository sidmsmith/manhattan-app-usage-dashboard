@echo off
cd /d "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"
git status > git_output.log 2>&1
git log --oneline -3 >> git_output.log 2>&1
echo. >> git_output.log
echo === END OF OUTPUT === >> git_output.log
