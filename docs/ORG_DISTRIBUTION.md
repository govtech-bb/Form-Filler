# Distributing Form Filler to GovTech Barbados

How to publish the **Form Filler** Chrome extension privately to the `govtech.bb`
Google Workspace organization. Distribution is via the **Chrome Web Store with
"Private" visibility** — Chrome blocks side-loaded `.crx` files on normal and
managed profiles, so this is the supported path.

There are two layers:

1. **Publish privately** — you, as the developer, upload the extension and
   restrict its visibility to the `govtech.bb` domain.
2. **(Optional) Deploy org-wide** — a Workspace admin force-installs it onto
   managed Chrome browsers.

---

## Prerequisites

- [ ] A **Chrome Web Store developer account** (one-time **$5** registration),
      signed in as **`name@govtech.bb`**. Use the org account so the
      "Private" visibility option can target the domain.
      Register at <https://chrome.google.com/webstore/devconsole>.
- [x] An **`icons` block in `manifest.json`** — done. The 16/32/48/128 PNGs
      live in `icons/` and are wired into both `icons` and `action.default_icon`.
- [ ] A **store icon (128×128 PNG)** — `icons/icon-128.png` can be reused — and
      at least **one screenshot (1280×800 or 640×400)** for the listing.
- [ ] A **built, zipped extension** — see [Build the package](#1-build-the-package).

---

## Before you publish

Icons are already set up: the PNGs live in `icons/` and `manifest.json`
references them from both `icons` and `action.default_icon`. CRXJS copies them
into `dist/icons/` on build — confirm they're present after `npm run build`.

The content script matches `<all_urls>`, which draws extra review scrutiny.
This is fine for a form-filler — just state the justification in the listing:
*"The extension fills form fields on any page the user explicitly triggers it on."*

---

## 1. Build the package

From the project root:

```powershell
npm install
npm run build
```

This produces the `dist/` folder. Zip its **contents** (the `manifest.json`
must be at the root of the zip, not inside a `dist/` subfolder):

```powershell
Compress-Archive -Path dist\* -DestinationPath form-filler-v1.0.0.zip -Force
```

> Re-zip and bump the `version` in `manifest.json` for every update — the Web
> Store rejects uploads that reuse an existing version number.

---

## 2. Publish privately to the org

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   as `name@govtech.bb`.
2. **Add new item** → upload `form-filler-v1.0.0.zip`.
3. Complete the **store listing**: name, description, category, language,
   the 128×128 icon, and at least one screenshot.
4. Complete **Privacy practices**: declare permission justifications
   (`activeTab`, `scripting`, `storage`, `tabs`, and the `<all_urls>` host
   access) and the single-purpose description.
5. Under **Visibility**, select **Private**. This restricts install to users
   signed into a `@govtech.bb` account.
6. **Submit for review.** Private items are reviewed but typically clear
   quickly. Once approved, share the store link with the team — only
   `@govtech.bb` accounts can install it.

---

## 3. (Optional) Force-install org-wide

To auto-deploy instead of having people self-install, a **Google Workspace
admin** does the following:

1. Note the extension's **item ID** from the dashboard (the long string in the
   store URL).
2. In the [Admin console](https://admin.google.com): **Devices → Chrome →
   Apps & extensions → Users & browsers**.
3. Select the target org unit, add the extension by item ID, and set the
   install policy to **Force install** (or **Allow install**).

> Force install applies only to Chrome browsers/profiles enrolled in the org's
> Chrome management. For everyone else, the private store link + self-install
> works for any signed-in `@govtech.bb` account.

---

## Updating the extension

1. Make changes and bump `version` in `manifest.json`.
2. `npm run build`, re-zip `dist/*`.
3. Dashboard → the existing item → **Upload new package** → submit for review.
4. Force-installed browsers update automatically; self-installed users update
   on Chrome's normal extension refresh cycle.

---

## Quick reference

| Step | Who | Where |
|------|-----|-------|
| Register dev account ($5) | You | Developer Dashboard |
| Add icons + build + zip | You | Local repo |
| Upload, set Private, submit | You | Developer Dashboard |
| Force-install (optional) | Workspace admin | Admin console |
