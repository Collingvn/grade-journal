# Composition — Grade Journal

Student grade tracker with semester filters, custom weighted categories, colored assignment folders, GPA, notes and PDF previews.

## Publish

In repository Settings → Pages, choose **Deploy from a branch**, **main**, **/(root)**, then Save. The expected URL is https://collingvn.github.io/grade-journal/.

In Firebase Authentication → Settings → Authorized domains, add `collingvn.github.io`. Enable Email/Password authentication. Publish the contents of `database.rules.json` in Realtime Database → Rules. The public web configuration is in `firebase-config.js`; it is not an administrative credential. Never commit service-account keys.

## Data boundaries

Firebase Authentication manages accounts and passwords. Journals are stored under `users/{uid}/journal` and restricted to that signed-in user by the database rules. A versioned transaction detects conflicting writes from multiple tabs; export changes and reload if a conflict occurs. Failed saves show a retry button. Export grades downloads a JSON backup.

PDF files currently remain in IndexedDB in the browser where they were uploaded, scoped by user ID. They do not sync across devices, and JSON backups do not include PDF bytes. Firebase Storage has not been configured. Existing Sites data does not transfer automatically to the GitHub Pages origin.

## Run locally

Run `python -m http.server 8000` and open http://localhost:8000. Firebase SDK modules load from Google's CDN; internet access is required.

## Validation

JavaScript syntax checks; Firebase configuration verified against the project configuration endpoint. No real user account or journal was created during deployment checks.

## Project notes

CS 215 final project, developed by Collin Gavin with AI assistance. GPA uses the app's configured grade mapping; institution-specific grading policies may differ.
