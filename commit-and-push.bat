@echo off
cd /d "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"
echo Starting commit process... > commit_output.log
git add -A >> commit_output.log 2>&1
git commit -m "v0.0.4: Remove column 3, align Recent Events header with Overall Summary, show 6 events in column 2" >> commit_output.log 2>&1
git push origin main >> commit_output.log 2>&1
git status >> commit_output.log 2>&1
echo Done. >> commit_output.log
