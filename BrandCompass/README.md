# BrandCompass

**Every draft. True to your brand.**

A complete hackathon prototype for **ByteRift — Poorvi S and Saathwik P Shettigar**, based on the supplied BrandCompass proposal for CodeNexus India.

BrandCompass checks draft content against an organisation's approved guidelines and facts, explains each finding, and routes the final decision to a human. It includes a real backend, persistent SQLite database, role permissions, revisions and audit history. It is not just a visual mockup.

## GitHub and live deployment

See **[GITHUB_AND_LIVE_SETUP.md](GITHUB_AND_LIVE_SETUP.md)** for repository creation, the exact upload list, Render deployment settings, database persistence and judge checks.

Keep all source files in one repository. GitHub stores the code; the hosting service runs the backend and database. GitHub Pages alone cannot run this application. The included `render.yaml` supports a GitHub-connected Node service; `.github/workflows/ci.yml` runs automated checks. The free Render configuration resets SQLite data on sleep/restart/redeploy; use persistent hosting for records you need to retain.

The existing hosted address is [BrandCompass](https://brandcompass-byterift-lab.s4395011.chatgpt.site). It was owner-only when checked on 8 November 2026, so it needs an explicit access change and signed-out verification before use by judges. GitHub pushes do not automatically update that existing Site.

## Run it on your laptop

1. Install **Node.js 24 LTS** from https://nodejs.org/ (Node 18/20 will not work).
2. Extract the entire ZIP. Open the `BrandCompass` folder in VS Code.
3. Open **Terminal → New Terminal** in that folder.
4. Run:

```bash
npm start
```

5. Open **http://localhost:3000** in Chrome, Edge or Firefox.
6. Click **Explore the live demo**. No account, npm package installation, paid API, Python, or external database is required.

Windows shortcut: double-click `START_WINDOWS.bat` after installing Node 24. On macOS/Linux: `bash start.sh`.

**Do not open `public/index.html` directly.** It needs the backend. Keep the terminal running while using the application. Press Ctrl+C to stop it. Your saved records remain in `data/brandcompass.sqlite`.

## What is included

| Capability | Implementation |
|---|---|
| Brand knowledge base | Versioned guidelines, approved facts with expiry, glossary replacements, palette and approved asset fingerprints |
| Content input | Paste text; import TXT, Markdown, selectable-text PDF or DOCX; attach PNG/JPEG/WebP |
| Rule review | Preferred terminology, tone phrases, shouting, claims, alt text, contrast, palette, asset identity, long sentences and offer conditions |
| Claim evidence | Current exact approved statements are supported; unmatched or expired claims are flagged, with relevant retrieved evidence |
| Explainable findings | Source ID, title, version, excerpt, flagged span, severity and method |
| Human corrections | Explicitly apply a suggestion, edit manually, dismiss or override with a reason |
| Review workflow | Draft → in review → approved / changes requested; edits create a new draft revision |
| Access control | Creator, manager, reviewer and administrator, checked on the server |
| Team accounts | Register an organisation, sign in, and provision members with roles |
| Governance insights | Live counts, channel totals and Guideline Health Score based on actual current findings and decisions |
| Evidence trail | Revision snapshots, comments, recorded approvals and a SHA-256-linked audit chain |
| Exports | Readable HTML report, JSON review, CSV findings and JSON workspace export |
| Optional AI | Opt-in OpenAI Responses API integration, retrieved sources, structured output and citation/span validation |
| Delivery | Local Node/SQLite application and deployable Worker/D1 build |

## Three-minute judge demo

Use the in-app **Demo guide** button or read `docs/DEMO_AND_PITCH.md`.

1. Open the seeded “A better everyday bottle” review. Show the unsupported **48 hours** claim and **INR 699** price. Expand the cited source.
2. Apply one preferred-word suggestion. Show that revision 2 is created automatically and checked again.
3. Replace the caption with the text from `samples/approved_caption.txt`. Expand **Image & accessibility checks**. Set text colour to `#172B26` and background to `#FFFFFF`. Save and review. The three product claims should match approved facts, with no configured violations.
4. Submit for approval. Switch the **Demo role** to **Manager** using the sidebar. Open the same review, approve it, and enter a reason.
5. Show **Insights**, **Audit trail → Verify chain**, revision comparison and export.

Demo role switching only works inside a newly created demo workspace. It does not allow a normal account to elevate its permissions. Demo workspaces remain in the database, but logging out loses the browser's access to that demo. Use a registered workspace for work you need to return to after logout.

## Image and document demonstration

The `samples` folder contains:

- `off_brand_caption.txt`: intentionally bad copy.
- `approved_caption.txt`: current approved statements.
- `sample_caption.pdf` and `sample_caption.docx`: selectable text import fixtures.
- `approved_logo.png`: approve it in Knowledge base → Visual assets, then upload the same file as a **logo** in a review.
- `off_palette_graphic.png`: upload as a **graphic** with empty alt text to demonstrate palette and accessibility findings.
- `claim_evaluation.json`: 30 labelled synthetic claim examples, including known failure cases.

A file is read locally in the browser. Extracted text and image metadata/thumbnail are sent to your application when you save. Original PDF/DOCX/image files are not retained on the server. PDF import is capped at 25 pages, documents/images at 5 MB, text at 16,000 characters, and images at 25 megapixels.

## Optional generative AI

Default mode is **deterministic rules plus lexical evidence retrieval**, not an LLM or a trained classifier. It works offline after Node is installed. Optional AI is implemented but was tested with mocked provider responses, not a paid live API call.

1. Copy `.env.example` to `.env` in the project folder.
2. Set your own server-side key and a compatible Responses API model:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

3. Restart `npm start`.
4. Select **Use optional AI review** before saving a draft.

The application sends the draft text and up to eight retrieved approved sources to OpenAI only for opted-in reviews. `store:false` disables response storage; it does not promise zero provider retention. No key is sent to the browser. Provider failure preserves local findings and is disclosed on the report. AI output is advisory: a valid citation ID and quote do not prove the model's interpretation is correct. Do not add confidential material until your organisation has approved the provider/data settings.

## Verification

```bash
npm test
npm run evaluate
```

The automated tests cover the rule engine, role restrictions, tenant isolation, CSRF guard, stale writes, revisions, expiry, approvals, account login, audit verification and optional-AI failure handling. `docs/TEST_RESULTS.md` records the executed checks. `docs/EVALUATION.md` reports the synthetic claim-warning evaluation, including failures. Neither the 0–100 check score nor that small evaluation is a real-world accuracy guarantee.

## Project map

| Path | Purpose |
|---|---|
| `server.mjs` | Local HTTP server and static asset serving |
| `src/api.mjs` | Auth, workspace isolation, validation, workflow and REST API |
| `src/engine.mjs` | Rules, lexical retrieval, claims, contrast and insight formulas |
| `src/ai.mjs` | Optional source-grounded model review |
| `src/reports.mjs` | Escaped HTML, JSON and spreadsheet-safe CSV exports |
| `src/security.mjs` | Password hashing, audit hashing and security headers |
| `src/local-db.mjs` | SQLite implementation of the D1 database interface |
| `src/seed.mjs` | Fictional Verdant policies, facts and seeded draft |
| `public/` | Responsive interface, document/image import and vendored PDF.js |
| `drizzle/` | Schema migrations for SQLite and hosted D1 |
| `tests/` | Dependency-free Node test suite |
| `scripts/evaluate.mjs` | Reproducible synthetic evaluation |
| `scripts/build.mjs` | Self-contained Cloudflare Worker build |
| `docs/` | Architecture, pitch, security, testing and development disclosure |
| `START_HERE.html` | Illustrated quick-start guide; open in a browser |

## Differences from the planning PDF

The proposal listed React/Next.js, FastAPI and PostgreSQL/pgvector as a **planned** stack. This implementation uses modern browser JavaScript, Node 24 and SQLite locally, plus Worker/D1 for hosting. The change removes installation and database-service friction for a hackathon demonstration. Retrieval is lexical rather than vector-based; the default review engine is rules-based. PDF/DOCX support means text extraction, not layout analysis. Basic visual checks are implemented; semantic logo recognition and OCR are not.

This is an end-to-end hackathon prototype, not a production-certified governance system. See `docs/SECURITY_AND_LIMITS.md` for specific boundaries and the migration path.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `node` or `npm` not recognised | Install Node 24 from the official site, then reopen VS Code/terminal. |
| `No such built-in module: node:sqlite` | Run `node --version`. Use Node 24, not Node 18/20. |
| Browser says connection refused | Keep `npm start` running and open the printed URL. |
| Port 3000 is busy | Run `node --env-file-if-exists=.env server.mjs --port 3001`, then open http://localhost:3001. |
| `package.json` not found | Open the terminal inside the extracted `BrandCompass` folder. |
| PDF contains no text | It is probably a scan. OCR it elsewhere and paste the extracted text. |
| Approval is rejected | Resolve or override high-severity findings, use another team member, submit first, and rerun after knowledge changes. |
| Workspace is out of date | Refresh the page, review the latest state and repeat the intended action. |
| AI option is disabled | Configure the server key in `.env` and restart. The core demo works without it. |
| Report export is blocked | Allow downloads for your local app and retry. The browser's Print option also works on the review screen. |
| Need a fresh demonstration | Sign out and choose Explore the live demo. This creates a new independent workspace. |

## Docker (optional)

```bash
docker compose up --build
```

Open http://localhost:3000. A named Docker volume preserves the database. The image installs no npm packages. Docker execution was not available in the build environment; the direct Node startup was tested.

## Sources and licences

- Node SQLite API: https://nodejs.org/download/release/v24.20.0/docs/api/sqlite.html
- WCAG contrast definition: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- OpenAI structured output format: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- PDF.js: https://mozilla.github.io/pdf.js/ (vendored version 5.6.205, Apache-2.0; licence included).

Original project code is MIT licensed. See `LICENSE` and `THIRD_PARTY_NOTICES.md`. Disclose AI assistance and reused libraries according to the event's rules; see `docs/DEVELOPMENT_DISCLOSURE.md`. No primary survey results, customer traction or commercial impact are fabricated.
