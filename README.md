# VVC-IS-THE-POVER

A framework-free, accessible digital school platform built with HTML, CSS, JavaScript and a Supabase realtime backend.

The repository began as an empty project. See `AUDIT.md` for the verified baseline and implementation constraints.

## Run locally

Serve the repository with any static web server and open `index.html` through that server. JavaScript modules do not run reliably from a `file://` URL.

Examples:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Architecture

- `index.html` — public school portal and local admin modal
- `style.css` — reference-aligned maroon/gold responsive design system
- `script.js` — updates, gallery, filtering, modals, local previews, and navigation
- `notices.html` — public Principal announcements page
- `js/official-notices.js` — safe official-notice storage, rendering, management, preview, print, expiry, and sharing
- `css/official-notices.css` — official notice, admin form, responsive, and print styling
- `AUDIT.md` — pre-implementation repository audit
- `REPORT.md` — implementation and validation report

No package install, framework, external font, remote image, or third-party script is required.

## Content safety

The portal follows the supplied Vavuniya Vipulanantha College reference. Administration uses Supabase password authentication, Row Level Security and an explicit administrator allowlist. Browser code contains only the public Supabase publishable key; backend secret keys must never be committed.

## Shared realtime backend

- `js/cloud-data.js` connects public pages and the admin dashboard to Supabase.
- `supabase/schema.sql` defines shared content, reactions, pending messages, media storage policies and realtime publication.
- Updates, gallery entries, notices and achievements synchronize across devices.
- Uploaded images and generated PDFs are stored in the `vvc-media` bucket.
- `localStorage` remains only as an offline display cache and one-time migration source.

## Smart document scanner

The scanner architecture is split into `js/document-scanner.js` and `css/document-scanner.css`. The **Scan Hard Document** option requests camera permission only after **Start Scanner** is pressed. Confirmed pages can be edited, reordered, converted into one PDF, and attached to a notice. Large scan assets are stored in IndexedDB rather than localStorage. OpenCV.js and jsPDF are loaded on demand; manual image capture and editing remain available if automatic edge detection is unavailable.

## Achievement Celebration Wall

Open `achievements.html` to view published student achievements, filters, sorting, reactions and approved congratulation messages. Administrators can create and moderate posts through the dashboard's **Awards** tab. Published achievements, reactions and moderated messages synchronize through Supabase; per-browser reaction identity remains a frontend limitation.

## Official Principal announcements

Sign in through the Admin button, open **Updates**, and expand **Principal signed notice**. Every notice must be previewed and finally confirmed before it is stored. Published active notices appear on the home page and `notices.html`; expired and archived notices remain manageable in the admin dashboard but are hidden publicly.

## Project reporting

- [Full project review](FULL-PROJECT-REVIEW.md)
- [Release register](RELEASES.md)
- [Performance optimization report](PERFORMANCE-OPTIMIZATION-REPORT.md)
- [Repository audit](AUDIT.md)
- [Implementation report](REPORT.md)

Every material change should be delivered through a feature branch and Pull Request using `.github/pull_request_template.md`. The PR must record the release month/year, improvements, tests, limitations, rollback notes and questions requiring school approval.
