# Factify Hindi · Live Growth Dashboard

A free live dashboard for your YouTube channel, hosted on GitHub Pages.
A GitHub Action fetches your public stats every 30 minutes and saves them to `data.json`.

Setup: see the steps Claude gave you, or:
1. Upload these files to a new **public** GitHub repo.
2. Settings → Secrets and variables → Actions:
   - **Secrets** tab → New secret `YT_API_KEY` = your YouTube Data API key
   - **Variables** tab → New variable `YT_HANDLE` = your @handle
3. Actions tab → "Update channel stats" → Run workflow.
4. Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
