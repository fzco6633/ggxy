Giftvault — Gift Card Marketplace Demo
DEMO ONLY — NO REAL PURCHASES OR PAYMENTS.
A static, front-end-only demo of a gift card marketplace. All brands (Streamly, GameCo, ShopPlus, FoodDash, TripNest) are fictional. No payments, cryptocurrency, or real accounts exist. Demo data is kept only in your browser's localStorage, and passwords are never stored.
Features
Premium dark UI, fully responsive (phone, tablet, desktop)
Search, category filters, and sorting
Demo sign up / log in, wallet, dashboard, order history
Card detail pages, simulated checkout, purchase confirmation with a demo code
Refund flow: 5-minute timer that starts at the simulated purchase; 10% fee calculated in cents (e.g. $22.00 paid → $2.20 fee → $19.80 refunded)
Structure
```
index.html
css/style.css
js/app.js
assets/favicon.svg
README.md
.gitignore
```
Run locally
No build step or dependencies. Either open `index.html` in a browser, or serve it:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```
Upload to GitHub
Create a new empty repository on github.com (e.g. `giftvault-demo`).
In this folder run:
```bash
git init
git add .
git commit -m "Initial commit: Giftvault demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/giftvault-demo.git
git push -u origin main
```
(Or use GitHub's "Add file → Upload files" and drag in the folder contents.)
Deploy to Vercel
Sign in at vercel.com with GitHub.
Click Add New → Project and import `giftvault-demo`.
Framework Preset: Other. Leave Build Command and Output Directory empty. Root Directory: `./`.
Click Deploy. You get a live URL in about a minute.
No environment variables or `vercel.json` are required.
Notes
Fonts load from Google Fonts; the site falls back to system fonts if offline.
Keep the demo notices in place if you modify or share this project.
To reset the demo, use "Reset demo data" on the dashboard or clear site data in your browser.
