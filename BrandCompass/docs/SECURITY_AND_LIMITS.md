# Implemented protections and prototype limits

## Implemented

- Tenant ID comes from the server-side session, not a client-selected organisation.
- Role checks and record ownership checks run in the API, independently of disabled UI controls.
- Passwords use PBKDF2-SHA256, 100,000 iterations and per-user random salts. Session tokens are random and only their SHA-256 digests are stored.
- Cookies are HttpOnly, SameSite=Strict, eight-hour sessions; Secure is added when served over HTTPS.
- Cross-origin mutation checks, a custom request header, JSON content-type requirement, input bounds and SQL parameter binding.
- Optimistic concurrency checks prevent silent stale overwrites.
- SHA-256-linked audit records are written with the workspace change.
- Static page Content Security Policy, MIME sniff protection, no remote fonts, no CDN dependency and no image-script formats accepted.
- Local file extraction, bounded decompression for DOCX, PDF limits, image limits and explicit AI opt-in.
- Exports exclude password hashes, session tokens and API keys. CSV cells are quoted, with potentially dangerous leading formula characters neutralised.

## Boundaries

This is a hackathon prototype, not a security certification or a full WCAG audit.

- The local SQLite file is **not encrypted at rest**. Use disk encryption, filesystem permissions, backups and TLS on an independently hosted server.
- An administrator with database write access can rewrite and rehash an audit chain. External append-only storage or signed anchors are needed for stronger assurance.
- No password reset, password-change screen, email verification, SSO, MFA, member suspension or invitations. Do not use real reused passwords for the demo.
- Demo workspaces have no automated expiry/cleanup. Rate-limit records and demo organisations need operational retention policies before public deployment.
- Role switching is a demo feature and is rejected for normal organisations. The app's demo is not a mechanism to access another workspace.
- Request rates are simple database counters, not distributed abuse prevention. The local server groups requests without a trusted upstream IP under `local`.
- Image metadata is calculated in the browser and trusted by the prototype API; hostile clients could forge it. No server antivirus, semantic visual model, OCR, logo geometry, cropping or layout analysis is included.
- DOCX/PDF extraction may omit tables, headers, footers, unusual encodings or image-contained text. Inspect extracted text. Scanned/encrypted PDFs are not supported.
- English-centric heuristic claim and tone detection can miss implicit claims, sarcasm and paraphrases, and can overflag benign numbers or greetings. Numeric equality is not real-world fact-checking: it only checks the approved internal corpus.
- An expired matching source cannot support a claim. Updating knowledge invalidates approval eligibility for all prior analyses.
- Optional AI is a real integration, but live provider calls were not tested with a paid key. Mocked success, invalid evidence and failure fallback were tested. Treat model output as advice.
- Demo limits: 40 drafts/workspace, 12 saved prior revisions/draft, 50 facts, 40 rules, 30 assets, 20 members, 100 comments/draft, 1.7 million characters of serialized workspace state. Knowledge history keeps the latest 20 snapshots. These limits keep the document-per-tenant prototype bounded; use a normalised schema to scale.
- The UI has keyboard focus, labels and responsive styles; no claim of full WCAG conformance is made. Content contrast checks use declared colour pairs, not a screenshot of the entire design.

## Next practical upgrades

Normalise storage, add email/SSO and recovery, server-side asset verification, object storage and malware scanning, signed audit anchors, vector/embedding retrieval, calibrated semantic claim classification, structured claim extraction, multilingual evaluation, OCR, logo geometry and external integrations. Validate all of these with representative users and a separately collected evaluation set.
