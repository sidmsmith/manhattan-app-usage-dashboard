# Copy Migration Script to Home Assistant

Quick guide to copy `migrate_ha_to_neon.py` to your HA instance.

## Option 1: Using File Editor (Easiest)

1. **Open File Editor in HA:**
   - Go to **Settings** → **Add-ons** → **File editor**
   - Or use the File Editor add-on if installed

2. **Navigate to `/config/manhattan_dashboard/`**

3. **Create new file:**
   - Click **"New File"** or **"+"** button
   - Name it: `migrate_ha_to_neon.py`

4. **Copy script contents:**
   - Open the script from your local machine: `apps_dashboard/manhattan_dashboard/migrate_ha_to_neon.py`
   - Copy all contents
   - Paste into File Editor
   - Save

## Option 2: Using SCP/SSH (If you have SSH access)

From your local machine (where the git repo is):

```bash
# Navigate to your git repo
cd "c:\Users\ssmith\OneDrive - Manhattan Associates\Documents\Solutions Consulting\Scripts\Web\apps_dashboard"

# Copy to HA (replace with your HA IP/hostname)
scp manhattan_dashboard/migrate_ha_to_neon.py root@your-ha-ip:/config/manhattan_dashboard/
```

## Option 3: Using Samba/Network Share

1. **Map HA config directory** (if using Samba)
2. **Navigate to:** `\\your-ha-ip\config\manhattan_dashboard\`
3. **Copy file:** `migrate_ha_to_neon.py` from your local repo
4. **Paste into** the HA `manhattan_dashboard` folder

## Option 4: Using HA Terminal (Copy-paste)

1. **Open HA Terminal:**
   - Settings → Add-ons → Terminal & SSH
   - Or Advanced Terminal

2. **Create the file:**
   ```bash
   cd /config/manhattan_dashboard
   nano migrate_ha_to_neon.py
   ```

3. **Paste contents:**
   - Copy the entire script from your local file
   - Paste into nano (right-click or Shift+Insert)
   - Save: `Ctrl+O`, Enter, `Ctrl+X`

## Verify Script is in Place

After copying, verify:

```bash
# From HA Terminal
ls -la /config/manhattan_dashboard/migrate_ha_to_neon.py
```

Should show the file exists and has execute permissions.

## Make Executable (Optional)

```bash
chmod +x /config/manhattan_dashboard/migrate_ha_to_neon.py
```

## Ready to Run

Once the file is in place:

```bash
cd /config
python3 manhattan_dashboard/migrate_ha_to_neon.py
```

---

**Quickest method:** Use File Editor add-on in HA to create the file and paste the script contents.

