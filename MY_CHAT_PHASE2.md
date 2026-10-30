# Phase 2 — release implementation

Base commit: `32127dc37086c1297f0103fb6567b90ff2158682`. No live credentials, paid provider calls, real user files, browser automation or cloud configuration changes were used.

## Documents

PDF, DOCX, XLSX and PPTX are processed locally in the browser. The original binary is not uploaded. Only extracted text (at most 8000 characters) becomes the existing consent-gated text attachment. The server independently enforces that text bound and the 16000-character conversation bound. No Files API, vector store or storage endpoint is used.

- Every input: at most 2 MiB; text-only extraction. No images/charts/layout/OCR. No encrypted documents or legacy DOC/XLS/PPT. User chooses a file, then explicitly consents before sending text.
- PDF: PDF.js 6.4.299 compatibility build, pinned npm package and integrity lock; same-origin authenticated assets. Dedicated module Worker, 10-second deadline, 10-page limit, streamed text extraction capped at 8000 characters. Eval, XFA, font rendering, WebAssembly and worker fetching disabled. No PDF actions, scripts, annotation navigation or embedded attachments are executed. Worker terminates on stop/logout/deadline. PDF.js does not offer a hard worker heap cap; the file/page/time/text bounds do not constitute a hard decompressed-memory guarantee for hostile PDFs.
- Office: bounded ZIP directory parsing before decompression; at most 300 entries, 1 MiB per expanded entry and 8 MiB declared expansion overall. Selected XML output is also capped during actual inflation. Duplicate/path-traversal entries, encryption, macro/ActiveX/embedded object entries and macro-enabled types are rejected. DTD/entities rejected; XML is parsed as inert data. Relationships are never fetched.
- PPTX: at most 20 slides, numerical slide order. XLSX: at most 20 sheets and 2000 cells; shared strings and saved values only. Formulas are not executed/recalculated; dates/styles are not formatted and charts are not read. DOCX has no reliable page count in the file; its bound is extracted characters, not claimed rendered pages.

Dependencies: npm registry `https://registry.npmjs.org`, scripts disabled, optional native canvas omitted. PDF.js assets are committed for static same-origin use; no CDN. `@xmldom/xmldom` 0.9.12 is a test-only XML parser. Reproduce with `npm ci --prefix tools/my-chat-documents --ignore-scripts --omit=optional`, `node tools/my-chat-documents/vendor.mjs`, `node build-my-chat.mjs`. License included. Authentication still guards all asset requests. CSP adds only `worker-src 'self'` and `media-src blob:`.

## API speech — temporary integration approved for publication

Current `/v1/audio/speech` uses `gpt-4o-mini-tts`, fixed `coral` voice and MP3 output. Official documentation says this model/API workflow is deprecated and shuts down **2027-01-06**; `gpt-realtime-2.1-mini` is NOT a drop-in speech endpoint model. This implementation rejects requests from that UTC date onward. It is a temporary option, not a durable replacement for Realtime. Parent approved temporary publication with the visible retirement date and server cutoff maintained. No automatic Realtime migration.

The user explicitly checks a separate send/cost notice and clicks API read-aloud. Only the last answer, up to 1000 characters, is sent. There is no automatic paid reading after ordinary chat/recording. UI discloses AI-generated voice and the retirement date. The shared tab-memory key is forwarded only to the fixed OpenAI endpoint with redirect following disabled. No audio/key is persisted. Response MIME/signature and 4 MiB size bound are validated; output is no-store. Playback uses a revocable Blob URL, paused/cleared on stop, dialog close, new operation, logout, pagehide or hidden document. An already-sent API call may still be billed after cancellation.

Existing authentication, Origin checks, revocation checks, global 100/day and session 6/minute limits apply. API speech also has a shared 30/day sublimit using the existing D1 table. No schema, binding, secret or new credential is required. Request count/size limits are not a guaranteed currency spending limit. No automatic retry. Browser autoplay restrictions may prevent playback; UI falls back to the existing device read button without automatically charging again.

## Verification

47 Node tests pass: original chat/voice/image/search/auth regressions, new protected assets, speech consent/bounds/retirement/quota, binary error sanitization, playback logout cleanup, document selection sending text only, real ZIP inflation and XML parsing, malicious archive/DTD/key-text rejection, PDF cancellation/settings/pages/length. A synthetic PDF was parsed with the actual vendored PDF.js. Node warns about omitted native canvas/DOMMatrix/Path2D; text extraction passes and rendering is not used.

Functions compilation and actual local workerd + D1 checks pass with upstream mocked. No real audio output quality/model entitlement, authenticated browser module Worker loading/CSP, mobile compatibility, actual browser document parsing/playback or live provider responses have been verified. Existing browser restrictions were not bypassed. Publication approved through the existing GitHub/Cloudflare Pages route. Authenticated same-origin module paths, JavaScript MIME, bundled files and worker/script CSP agreement are tested; this does not substitute for a real-browser Worker test.

## Designs only: Realtime and persistent keys

Realtime option A: authenticated same-origin server WebSocket proxy, existing user key held only for a bounded session, fixed upstream URL/model, input/output limits, 3-minute maximum, server-side close and periodic auth revocation checks. Avoids issuing browser short-lived credentials but needs transport/proxy lifecycle validation, cost budget, and possibly a session ledger or Durable Object binding. Those cloud additions require approval before execution.

Realtime option B: browser WebRTC with newly issued short-lived provider credential, issued only after authenticated explicit Start, 3-minute UI/session bound, fixed model/tools and server-side session termination/revocation plan. Requires explicit authorization to issue temporary credentials and broaden the browser's connection policy. Client-only timers do not enforce a spending ceiling. Neither option was implemented or activated.

Key persistence option A (current): memory only; no new stored secrets; key must be re-entered after reload. Option B: browser IndexedDB stores only AES-GCM ciphertext with a separate user unlock password-derived key and random salt/nonce; unlock key stays in memory, e.g. 30-day ciphertext expiry plus explicit Delete. Logout locks memory; deleting stored ciphertext must be a separate clear action. Does not protect against XSS while unlocked; weak unlock passwords permit offline guessing after ciphertext theft. Requires agreement on unlock/password recovery, expiry and deletion behavior before implementation; no passwords or salts were created.

Option C: server vault encrypted under a new Cloudflare Secret, ciphertext plus owner/expiry in D1, e.g. 24-hour initial TTL, explicit Delete and logout policy. Requires approval for new secret/configuration and persistent key custody. App must document backup/log retention and cannot promise immediate removal from provider backups. A compromised server decryptor can expose stored keys. With All permissions, leaked keys may enable all actions permitted to that project; provider revocation/rotation and billing limits are essential recovery controls. No key was read, generated, saved or permission-changed.

## Official references

- https://developers.openai.com/api/docs/guides/file-inputs
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create/
- https://developers.openai.com/api/docs/guides/realtime
- https://mozilla.github.io/pdf.js/api/draft/api.js.html


## Recommendations for the next explicit user decision (design only)

Realtime: recommend option A, an authenticated server WebSocket proxy with the existing tab-memory key; no temporary browser credential. Audio goes browser -> the existing Cloudflare site -> fixed OpenAI Realtime endpoint, with output returned the same way. Proposed initial bounds: 3 minutes per connection, 10 starts/UTC day, one connection per session, no external tools, server-enforced close plus revocation checks. Provider audio-token fees and Cloudflare execution/traffic costs apply; these bounds are not a dollar ceiling. Audio and plaintext key are retained only in connection memory, closed/cleared at Stop, logout or the duration limit; provider retention remains governed by account terms. Approve the transport and usage bounds first; any required new binding/resource must be specified before creation. No change to paid Cloudflare plans is authorized.

Persistent key: recommend option B, opt-in encrypted storage in this browser only, using a separate strong unlock password. Ciphertext is stored in IndexedDB, never synced by this application to its server. Reload requires unlocking rather than retyping the API key. Use PBKDF2 with a calibrated strong work factor and AES-GCM; salts/nonces are not passwords. Propose a 30-day logical expiry; expired ciphertext is removed on the next app start (no claim of deletion while the browser is closed). Explicit Delete removes ciphertext and clears unlocked memory; logout locks memory but keeps ciphertext until expiry/Delete. No storage-service fee; API charges are unchanged and the decrypted key still transits the site server to OpenAI when used. Browser/profile theft plus a weak unlock password permits offline guessing; XSS while unlocked can still steal the key. There is no password recovery. Provider-side revocation is the reliable response to key leakage. Confirm local storage, separate unlock password, retention and logout-vs-delete behavior before implementing; nothing has been persisted.
