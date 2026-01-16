# Setup and Deployment Guide

## 🎯 Quick Answer

**To run this code and push changes, you need:**

1. ✅ **GitHub Desktop** (you already have this!)
2. ✅ **Node.js** (you already have this!)
3. ✅ **Git** (usually comes with GitHub Desktop)

---

## 📋 Step-by-Step Setup

### **Step 1: Verify Node.js Installation** ✅

Since you already have Node.js installed, let's verify it works:

1. Open PowerShell or Command Prompt
2. Run: `node --version` (should show a version number)
3. Run: `npm --version` (should show a version number)

If both commands work, you're all set! ✅

### **Step 2: Install Project Dependencies**

1. Open PowerShell or Command Prompt
2. Navigate to your project folder:
   ```powershell
   cd "C:\Users\tkoch\Documents\GitHub\Miss-Woo"
   ```
3. Install dependencies:
   ```powershell
   npm install
   ```
   This will create a `node_modules/` folder with all required packages.

### **Step 3: Test Locally** (Optional but Recommended)

1. **Option A: Simple Test (No Server)**
   - Just double-click `index-dev.html` to open in your browser
   - This works for basic testing

2. **Option B: Full Development Server**
   - In PowerShell, run:
     ```powershell
     npx http-server -p 3000 --cors
     ```
   - Open browser to: `http://localhost:3000/index-dev.html`
   - Press `Ctrl+C` to stop the server when done

3. **Run Tests** (Optional):
   ```powershell
   npm test
   ```

---

## 🚀 Making Changes and Pushing to GitHub

### **Using GitHub Desktop** (Recommended for you)

1. **Make Your Changes**
   - Edit files in `src/` folder (e.g., `src/app.js`, `src/config.js`)
   - Test locally using `index-dev.html`

2. **Commit Changes in GitHub Desktop**
   - Open GitHub Desktop
   - You should see your changes listed
   - Write a commit message following conventional commits:
     - `feat: add new feature`
     - `fix: fix bug description`
     - `chore: update dependencies`
   - Click **"Commit to main"** (or create a new branch first)

3. **Push to GitHub**
   - Click **"Push origin"** button in GitHub Desktop
   - This uploads your changes to GitHub

4. **Automatic Deployment**
   - GitHub Actions will automatically:
     - Run tests
     - Build production files
     - Deploy to GitHub Pages
   - Check deployment status: Go to your repo → **Actions** tab
   - Your changes will be live at: https://bryanquikrstuff.github.io/Miss-Woo/

---

## 📝 Using Command Line (Alternative to GitHub Desktop)

If you prefer command line:

```powershell
# Navigate to project
cd "C:\Users\tkoch\Documents\GitHub\Miss-Woo"

# Check status
git status

# Add all changes
git add .

# Commit with message
git commit -m "feat: your change description"

# Push to GitHub
git push origin main
```

---

## 🔍 What Gets Deployed Automatically?

When you push to `main` branch:

1. ✅ **Tests run** (via GitHub Actions)
2. ✅ **Production files built** (copies `src/` to `dist/`)
3. ✅ **Deployed to GitHub Pages** (live at the URL above)

**No manual steps needed!** Just commit and push.

---

## ⚠️ Important Notes

### **Files You Should NOT Commit:**
- `node_modules/` (already in `.gitignore`)
- `.env` files (already in `.gitignore`)
- Personal notes or temporary files

### **Files You SHOULD Commit:**
- `src/` folder (your code)
- `index.html` and `index-dev.html`
- `package.json` and `package-lock.json`
- Documentation files (`.md` files)

### **Before Pushing:**
1. ✅ Test your changes locally
2. ✅ Make sure tests pass (`npm test`)
3. ✅ Verify API keys are not hardcoded (use placeholders in `config.js`, actual keys stored in GitHub Secrets)

---

## 🐛 Troubleshooting

### **"npm: command not found"**
- Node.js is not installed or not in PATH
- Reinstall Node.js and restart your terminal

### **"git: command not found"**
- Git is not installed
- GitHub Desktop includes Git, but you may need to add it to PATH
- Or just use GitHub Desktop GUI instead

### **"Permission denied" when pushing**
- Check that you're authenticated in GitHub Desktop
- Go to GitHub Desktop → File → Options → Accounts
- Make sure you're signed in

### **GitHub Actions failing**
- Check the **Actions** tab in your GitHub repo
- Look at the error logs
- Common issues:
  - Tests failing (fix the code)
  - Missing GitHub Secrets (add them in repo Settings → Secrets)

---

## 📚 Quick Reference Commands

```powershell
# Install dependencies
npm install

# Run local server
npx http-server -p 3000 --cors

# Run tests
npm test

# Check git status
git status

# View recent commits
git log --oneline -5
```

---

## ✅ Checklist Before Your First Push

- [x] Node.js installed (`node --version` works) ✅ **You're done with this!**
- [ ] Dependencies installed (`npm install` completed) ← **Do this next**
- [ ] Can open `index-dev.html` in browser
- [ ] GitHub Desktop connected to your repo
- [ ] Made a test change and verified it works
- [ ] Ready to commit and push!

---

## 🎉 You're Ready!

Once you've completed the setup:
1. Make your code changes
2. Test locally
3. Commit in GitHub Desktop
4. Push to GitHub
5. Wait for automatic deployment (check Actions tab)
6. View your changes live at: https://bryanquikrstuff.github.io/Miss-Woo/

**That's it!** The deployment is fully automated. 🚀

---

**Last Updated**: January 2025  
**Project**: Miss-Woo  
**Repository**: https://github.com/BryanQuikrStuff/Miss-Woo

