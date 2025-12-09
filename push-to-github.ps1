# Git Push Script for Manhattan App Usage Dashboard
# This script will show you exactly what's happening with git

Write-Host "=== Git Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Recent Commits ===" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n=== Remote Configuration ===" -ForegroundColor Cyan
git remote -v

Write-Host "`n=== Branch Tracking ===" -ForegroundColor Cyan
git branch -vv

Write-Host "`n=== Attempting Push ===" -ForegroundColor Yellow
git push origin main

Write-Host "`n=== Final Status ===" -ForegroundColor Cyan
git status
