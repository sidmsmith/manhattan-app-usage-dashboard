# Force commit and push script
Write-Host "=== Current Git Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Staging All Changes ===" -ForegroundColor Yellow
git add -A
git status --short

Write-Host "`n=== Committing Changes ===" -ForegroundColor Yellow
git commit -m "v0.0.4: Remove column 3, align Recent Events header with Overall Summary, show 6 events in column 2"

Write-Host "`n=== Recent Commits ===" -ForegroundColor Cyan
git log --oneline -3

Write-Host "`n=== Pushing to GitHub ===" -ForegroundColor Yellow
git push origin main

Write-Host "`n=== Final Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Remote Status ===" -ForegroundColor Cyan
git log --oneline origin/main -3
