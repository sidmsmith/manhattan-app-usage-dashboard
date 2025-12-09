# Force commit and push script
Write-Host "Staging all files..." -ForegroundColor Yellow
git add -A

Write-Host "`nChecking staged files..." -ForegroundColor Yellow
git status --short

Write-Host "`nCommitting..." -ForegroundColor Yellow
git commit -m "Update to v0.0.2: Add version display in header and title, fix JSON parsing for recent events, add package.json and setup docs" --no-verify

Write-Host "`nVerifying commit..." -ForegroundColor Yellow
git log --oneline -1

Write-Host "`nPushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host "`nFinal status..." -ForegroundColor Yellow
git status
