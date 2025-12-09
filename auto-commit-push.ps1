# Automated commit and push script with verification
# This script commits, pushes, and creates a verification file

param(
    [string]$CommitMessage = "Auto-commit"
)

Write-Host "=== Staging Changes ===" -ForegroundColor Yellow
git add -A
$staged = git diff --cached --name-only

if ($staged.Count -eq 0) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    exit 0
}

Write-Host "Files to commit:" -ForegroundColor Cyan
$staged | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== Committing ===" -ForegroundColor Yellow
git commit -m $CommitMessage

Write-Host "`n=== Pushing to GitHub ===" -ForegroundColor Yellow
git push origin main

Write-Host "`n=== Verification ===" -ForegroundColor Cyan
$verification = @"
Commit Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Commit Message: $CommitMessage
Latest Commit: $(git log --oneline -1)
Remote Status: $(git log --oneline origin/main -1)
Branch: $(git branch --show-current)
"@

$verification | Out-File -FilePath "last_commit_verification.txt" -Encoding utf8
Write-Host $verification
Write-Host "`nVerification saved to last_commit_verification.txt" -ForegroundColor Green
