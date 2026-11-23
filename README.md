# Turning Pages

A mobile-friendly, 1980s-inspired gamebook reader for GitHub Pages. Open a PDF, follow branching page choices, jump to any page, retrace your steps, or restart the adventure.

## Run locally

Install Node.js 24 LTS, then run these commands from this folder:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite. Use `npm run build` to generate the static site in `dist`, and `npm run preview` to preview that build.

## Read a book

1. Select **Open a PDF** and choose a PDF with selectable text.
2. In **Reader settings**, identify the PDF page that contains printed page 1. For a cover, two introduction pages, then story page 1, enter `4`.
3. The first PDF page is used as a faded, full-screen background. Change **Use this PDF page as the cover** if necessary, and adjust its intensity. Zero hides it.
4. Follow generated **Turn to page** buttons, use **Continue** to advance sequentially, or enter any printed page number in **Go to page**.
5. **Restart book** returns to printed page 1 and clears the reading trail, without deleting the book or settings.

The app recognizes common English references such as "turn to page 42", "go to 12", and "page 9". Detection is best-effort; unusual wording, OCR errors, or references to a range may require the manual page jump. One PDF page maps to one printed page. This is not a numbered-section parser.

## Local saving and privacy

The PDF, extracted text, cover image, settings, and progress are stored in IndexedDB on the current browser and device. No PDF is uploaded. PDF.js and its worker, font, and decoding assets are served with the site, without a third-party CDN. There are no analytics or accounts.

Only the most recently opened book is retained. Opening another PDF or selecting the demo replaces it. Clearing browser site data, private browsing, storage limits, or browser eviction may remove saved books. There is no cross-device sync; open the PDF separately on your phone.

Scanned/image-only PDFs need OCR before import. Password-protected PDFs need an unlocked copy. Complex multi-column layouts may extract in an imperfect order; illustrations are not reproduced in the reading text. The cover is rendered from the actual PDF page, including its artwork.

## Publish to GitHub Pages

1. Create a GitHub repository and push the contents of this folder to its `main` branch.
2. In **Settings > Pages > Build and deployment**, set **Source** to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` tests, builds, and deploys on a push to `main`. If the initial run happened before enabling Pages, rerun it in **Actions**.
4. Find the published address in **Settings > Pages** or the deployment workflow.

Assets use relative paths, so the build works under a repository subpath or a custom domain. No backend or API key is required. Do not commit your books; visitors select their own local PDFs.

## Validation

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests run against the production build under a repository subpath on desktop and phone-sized Chromium. They cover real PDF import, page offsets, nonlinear navigation, cover rendering, saved settings/progress, restart, corrupt PDFs, and OCR guidance. Test PDFs contain only original fixture text. `npm run check` runs all three checks once a Playwright browser is installed.
