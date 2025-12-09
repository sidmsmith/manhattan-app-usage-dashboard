# Git Authentication Setup

## Current Configuration

I've configured:
- **Credential Helper**: `manager-core` (Git Credential Manager for Windows)
- **Remote URL**: HTTPS (https://github.com/sidmsmith/manhattan-app-usage-dashboard.git)

## To Enable Automatic Authentication:

### Option 1: Authenticate Once (Recommended)
1. Run this command in PowerShell:
   ```powershell
   cd "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"
   git push
   ```

2. When prompted:
   - **Username**: Your GitHub username
   - **Password**: Use a **Personal Access Token** (not your GitHub password)
   
3. Git Credential Manager will store these credentials securely
4. Future pushes will work automatically

### Option 2: Use SSH Keys (More Secure)
If you prefer SSH:

1. Generate SSH key (if you don't have one):
   ```powershell
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. Add SSH key to GitHub:
   - Copy the public key: `cat ~/.ssh/id_ed25519.pub`
   - GitHub → Settings → SSH and GPG keys → New SSH key
   - Paste the key

3. Switch remote to SSH:
   ```powershell
   cd "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"
   git remote set-url origin git@github.com:sidmsmith/manhattan-app-usage-dashboard.git
   ```

### Option 3: Personal Access Token in URL (Less Secure)
Store token in git config (not recommended for shared machines):

```powershell
git config --global credential.helper store
# Then on first push, use token as password
```

## Verify Configuration

Check your current setup:
```powershell
git config --global credential.helper
git remote -v
```

## Test Automatic Push

After setting up, test with:
```powershell
cd "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"
echo "# Test" >> README.md
git add README.md
git commit -m "Test automatic push"
git push
```

If it works without prompting, authentication is set up correctly!
