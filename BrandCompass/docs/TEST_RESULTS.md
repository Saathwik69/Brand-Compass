# Verification record

Executed on 8 November 2026 with Node.js v24.22.1 in the build environment.

## Automated checks

### GitHub/deployment preparation, 8 November 2026

- Re-ran `npm test`: 35 passed, 0 failed; `npm ci` and the Worker build completed.
- Added `npm run smoke -- <app-origin>` and exercised the actual local HTTP server: 9 checks passed.
- Exercised the existing deployed Worker/D1 app at `https://brandcompass-byterift-lab.s4395011.chatgpt.site` using authorized service access: all 9 HTTP checks passed, including saved review, supported claims, independent approval, report exports, audit and logout.
- A separate anonymous request returned HTTP 401. The existing Site remains owner-only. Successful authorized API checks do not prove public judge access; an explicit sharing change and signed-out browser verification are still required.
- Added GitHub Actions and a Render Blueprint. These configuration files were prepared locally; no GitHub Actions run or Render deployment is claimed until the repository and hosting setup are completed.
- The HTTP checker tracks only the application's session cookie so additional hosting cookies cannot replace it.

The earlier browser observations below were retained from the supplied project. No new browser UI or paid-provider test is claimed by this packaging pass.

`npm test`: **35 tests passed, 0 failed**.

| Area | Checks performed |
|---|---|
| Engine | Terminology boundaries, tone, approved/unsupported/expired claims, negation, exact source spans, contrast, alt text, palette, logo fingerprints, offer conditions and health calculation |
| Security and workflow | Login and password hashing, session guards, cross-origin rejection, tenant separation, server-enforced roles, stale updates, self-approval protection, high-severity blockers, reasoned overrides, immutable revisions and knowledge changes |
| Evidence | Audit-chain verification, optional AI response validation, forged-source rejection and provider-failure fallback |
| Exports | Authenticated tenant-scoped HTML/JSON/CSV endpoints, HTML escaping, spreadsheet-formula neutralisation and approval status |

`npm run evaluate`: 30 synthetic claim-warning examples. TP 14, TN 10, FP 2, FN 4; precision 87.5%, recall 77.8%, F1 82.4%. These examples are a transparent development check, not an independent or representative benchmark. See EVALUATION.md for every failure.

## Browser checks

Performed in Chromium using the actual local application and SQLite backend:

- Created an isolated demo workspace and opened the seeded review: eight findings, score 6/100.
- Applied a terminology suggestion; observed a new revision and recalculated findings.
- Entered the approved caption and a compliant declared colour pair; observed three supported claims and zero findings.
- Submitted the review, changed to a different demo team member, and recorded an approval.
- Imported the sample selectable-text PDF, saved it and reviewed the resulting text.
- Opened the server-generated printable report and verified its draft status, findings, sources and disclosure.
- Inspected the 390-pixel mobile layout: body content width equalled the available viewport width (375 CSS pixels after the scrollbar). Wide tables scroll within their own container.
- Inspected the desktop overview and review studio.

The initial client-side Blob report download was unreliable in the remote test browser. Reports were moved to authenticated server download routes; those routes passed automated response/header/content checks and the printable report rendered in the browser. Downloading a file on every browser/OS was not tested.

## What remains unverified

- A paid, live OpenAI API request: the integration was tested using mocked valid, invalid and failed provider responses. The default demonstration requires no key.
- DOCX and image selection through the final browser UI: implementation and fixtures are included, but only PDF selection was exercised end to end in the remote browser. Engine tests cover the visual metadata rules.
- Docker execution, Windows and macOS launchers on those operating systems, and physical mobile devices.
- Load testing, independent penetration testing, model accuracy on real brand content, and production compliance certification.

All results describe this prototype and this environment. They do not promise error-free operation on every device or input.
