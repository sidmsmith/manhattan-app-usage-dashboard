# Verify git status and recent commits
Write-Host "=== Git Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Recent Commits ===" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n=== Remote Status ===" -ForegroundColor Cyan
git log --oneline origin/main -3

Write-Host "`n=== Branch Tracking ===" -ForegroundColor Cyan
git branch -vv

# Write to file for AI to read
$output = @"
=== Git Status ===
$(git status)

=== Recent Commits ===
$(git log --oneline -5)

=== Remote Status ===
$(git log --oneline origin/main -3)
"@

$output | Out-File -FilePath "git_status_verification.txt" -Encoding utf8
Write-Host "`nStatus written to git_status_verification.txt" -ForegroundColor Green
