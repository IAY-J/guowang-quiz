$ErrorActionPreference = 'Stop'

git add -- .gitignore index.html app.js style.css bank-data.js sample-bank.json README.md BANK_FORMAT.md gen_bank.py validate_bank.py make_import_test.py import-test-bank.json tongxin-moni-kaoshi.json peixun-tiji.md quanshu-tiji.md xinzeng-ziliao-tiku.json manifest.webmanifest icons/ xinti-yulan.md deploy.ps1 server.js
git commit -m "Update quiz app"
git push origin main

Write-Host "Deployed to https://iay-j.github.io/guowang-quiz/ (wait 1-2 minutes for Pages build)"
