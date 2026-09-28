# Google Apps Script deployment

This folder contains a self-contained Google Apps Script web app. It preserves the quote calculator, shared rebate settings, take-home quote links, and the staff order-request inbox.

## Set up

1. Create a standalone project at [script.google.com](https://script.google.com/).
2. Add the files in this folder. Use the exact names `Code.gs`, `Index.html`, `Rebates.html`, and `PatientOrder.html`. Enable **Show appsscript.json manifest file** in Project Settings and replace the manifest with `appsscript.json`.
3. In **Project Settings → Script properties**, add `STAFF_ACCESS_KEY` with a private, high-entropy value. Give this key only to office staff.
4. Select **Deploy → New deployment → Web app**. Execute as **Me** and allow access to **Anyone** so patient quote links can open without a Google account.
5. Open the deployment URL and enter the staff access key when prompted. Do not append a trailing slash or copy the temporary `/dev` test URL for patients.

The public patient page can submit a request but cannot read saved rebate settings or the request inbox without the staff key. Patient quote links expire after 14 days. The app retains at most 200 order requests in Script Properties; export or clear completed requests before relying on it as a long-term record.

## Rebuild and test

From the repository root:

```text
node scripts/build-gas.js
node scripts/test-quote.js
node scripts/test-gas-build.js
```

The build embeds the current browser app's CSS and JavaScript into Apps Script-compatible HTML files. Re-run it after changing the source prototype, then upload the regenerated HTML files.

