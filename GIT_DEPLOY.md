# Uploading to Git & syncing to Bonto

You have two options. **Option A is simplest** — Bonto has its own Git
server, so you don't need GitHub at all. **Option B** goes through GitHub
first (useful if you also want a backup/history of your code there).

---

## Option A — Push straight to Bonto (simplest)

1. Install [Git](https://git-scm.com/downloads) if you don't have it.
2. On [bonto.run](https://bonto.run), create a new **Node.js app** (or open
   your existing `pectaa` app) — this gives you a Bonto Git remote URL,
   something like `https://git.bonto.run/<you>/pectaa.git`. Copy it.
3. Open a terminal **inside this `slide-studio-live` folder** and run:
   ```
   git init
   git add .
   git commit -m "Slide Studio live server"
   git branch -M main
   git remote add bonto https://git.bonto.run/<you>/pectaa.git
   git push bonto main
   ```
4. Bonto installs `npm install` and starts `node server.js` automatically —
   your server redeploys. Watch progress in the Bonto dashboard's logs.
5. **Every time you change something** (e.g. drop in a newer
   `public/index.html` from Slide Studio), just run:
   ```
   git add .
   git commit -m "update"
   git push bonto main
   ```
   That one command re-syncs everything to `pectaa.bonto.run`.

---

## Option B — Push to GitHub, then connect Bonto to it

1. Install Git, then from inside this folder:
   ```
   git init
   git add .
   git commit -m "Slide Studio live server"
   git branch -M main
   ```
2. On [github.com](https://github.com/new), create a new **empty** repository
   (don't tick "add a README" — this folder already has one). Copy its URL,
   e.g. `https://github.com/<you>/slide-studio-live.git`.
3. Push to it:
   ```
   git remote add origin https://github.com/<you>/slide-studio-live.git
   git push -u origin main
   ```
4. On [bonto.run](https://bonto.run), open your app → connect it to this
   GitHub repository (Bonto's "Git" / "Import from GitHub" option). Bonto
   will now auto-redeploy every time you push to GitHub.
5. From then on, just:
   ```
   git add .
   git commit -m "update"
   git push origin main
   ```
   GitHub → Bonto redeploys on its own within a few seconds.

---

## After either option: set your password (recommended)

In the Bonto app's **Environment Variables** settings, add:
```
STUDIO_PASSWORD = <a password you choose>
```
This locks the editor (`https://pectaa.bonto.run/`) behind a login prompt
and is required for your "host" connection to be trusted — see the main
README's security note. Restart/redeploy the app after adding it for it to
take effect.

## Updating the presentation itself later
You don't need Git for everyday slide editing — just open
`https://pectaa.bonto.run/` in a browser and edit there directly (it saves
itself). You only need to `git push` again when you want to install a
**newer version of the Slide Studio app itself** — replace
`public/index.html` with the new export, then push as above.

---

## Windows CMD — exact copy-paste commands

1. **Git install hai ya nahi check karein** — Start menu mein `cmd` type karke Command Prompt kholein, phir:
   ```
   git --version
   ```
   Agar "not recognized" ka error aaye, pehle Git install karein: https://git-scm.com/download/win
   (installer mein sab default options rakh kar "Next Next Finish" kar dein)

2. **ZIP ko extract karein** (jaise Downloads mein `slide-studio-live` naam se nikaal lein), phir usi folder mein jayein:
   ```
   cd Downloads\slide-studio-live
   ```
   (agar folder kahin aur hai to wahan ka sahi path likhein)

3. **Git repo banayein aur sab files commit karein:**
   ```
   git init
   git add .
   git commit -m "Slide Studio live server"
   git branch -M main
   ```

4. **Bonto ka Git URL add karein aur push karein** — Bonto dashboard mein apni `pectaa` app ke "Git" settings mein jakar URL copy karein, phir:
   ```
   git remote add bonto https://git.bonto.run/your-username/pectaa.git
   git push bonto main
   ```
   (`your-username/pectaa.git` wali jagah apna asal URL dalein)

   Pehli baar push karte waqt ye username/password ya token manga ja sakta hai — Bonto jo bhi credentials de, wahi dalein.

5. **Ho gaya.** Bonto dashboard ke "Logs" mein dekh sakte hain ke deploy chal raha hai. 1-2 minute mein `https://pectaa.bonto.run/` par naya version live ho jayega.

### Agli baar jab bhi update karna ho (sirf 3 lines):
```
git add .
git commit -m "update"
git push bonto main
```

### Agar koi error aaye:
- `fatal: not a git repository` → aap sahi folder mein nahi hain, `cd` se sahi folder mein jayein (step 2 dobara karein)
- `remote origin already exists` ya `remote bonto already exists` → pehle `git remote remove bonto` chalayein, phir step 4 dobara karein
- Push karte waqt password kaam na kare → Bonto ab zyada tar ek "access token" mangta hai (password ki jagah) — ye aap ko Bonto dashboard ke account/settings mein milega
