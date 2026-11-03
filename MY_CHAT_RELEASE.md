# My Chat: text and turn-based voice (not yet published)

## Follow-up: Workers redirect compatibility fix

The initial release and shared-key UI were published. A reported generic connection error exposed a runtime incompatibility: Workers throws TypeError for `redirect: 'error'`. The API now uses `manual` and explicitly rejects all 3xx responses without following Location. Fixed upstream destinations, authentication and quotas are unchanged. No DB or secret changes are required for this fix.

Errors now return safe stage codes (`DB_CONTROL`, `UPSTREAM_CONNECT`, `UPSTREAM_RESPONSE`, `UPSTREAM_REDIRECT`) without exception text, credentials or message contents. Production database metadata and actual provider calls have not been inspected.

24 Node tests pass. `tests/my-chat-workers-check.mjs <installed miniflare package directory>` additionally runs against local workerd/Miniflare 5: the old TypeError was reproduced, and the fixed text/audio request construction, D1 `withSession` queries, lock and rate quota passed using a mocked upstream. No paid API call was used.

Runtime reference: https://developers.cloudflare.com/workers/runtime-apis/request/

Prepared locally on 2026-10-30. The previous live commit is c7dd96d5d2c563b8ed622656b348554a45fa9011.

## Before publication

1. In the existing D1 database `my-chat-auth` bound as `MY_CHAT_AUTH_DB`, execute the single statement in `tests/my-chat-api-schema.sql`. It adds a separate quota/lease table and does not change authentication tables. Do not recreate existing tables or secrets.
2. Run `node build-my-chat.mjs` and `node --test tests/my-chat-auth.test.mjs tests/my-chat-api.test.mjs tests/my-chat-ui.test.mjs`.
3. Commit the My Chat source, generated asset module, build script, tests, schema and this note; push using the existing Git/Cloudflare Pages flow. No new credential, service or paid plan is needed. The D1 table has NOT been applied by this task.
4. Confirm the exact commit's deployment and open `/my-chat/` afresh. Confirm anonymous HTML/assets/API rejection, login, logout, same-origin policy and microphone behavior. Browser rendering and real-device microphone/speech behavior have not been exercised here.
5. The user enters their own keys in the protected settings screen. Applying keys only sets tab memory; it does not test or bill the API. A real text send or recording upload spends API credits and requires the user's separate approval for testing. No paid API tests were made in this task.

## Data and limits

- Keys stay in a closure in this tab, cleared on reload, page exit, logout, session expiry or the erase button. There is no localStorage, sessionStorage, cookie, database or repository key persistence. Every API request sends its key over HTTPS to this site's Function and then to the fixed OpenAI endpoint. This is a personal BYOK design: scripts/extensions on the user's device can access a live tab. The same-origin toolbox must remain trusted. It is not a server-only key vault.
- Text uses `POST https://api.openai.com/v1/responses`, model `gpt-5.4-mini`, reasoning `none`, `store:false`, max output 1200 tokens. The UI sends at most the last 20 messages and 16000 characters; each message is limited to 4000 characters. Older context is omitted. No tools or arbitrary upstream URL/model passthrough.
- Recorded audio uses `POST https://api.openai.com/v1/audio/transcriptions`, model `gpt-transcribe`. Browser MIME negotiation chooses WebM or MP4. The client stops/sends at 60 seconds and rejects over 2 MiB; the server independently caps 2 MiB (not audio duration). No raw recording is persisted by the application.
- Reading uses browser SpeechSynthesis, not OpenAI TTS. Voice availability and playback policies vary by device. A replay button is provided. Browser voices may use their provider's processing; the UI discloses this. This is turn-based, not Realtime or interruption-capable speech.
- A D1 atomic lease permits one upstream request per login session, a quota allows 6 requests per minute per session and 100 per UTC day site-wide. Transcription and text each count separately, including unsuccessful upstream attempts. These are request limits, not a currency budget; they do not constrain use of the key outside this site. The 60-second server timeout propagates client aborts. Cancellation cannot guarantee no charge after an upstream request starts. No automatic retries.
- Missing quota schema fails closed before provider fetch. The existing passphrase verifier, signed HttpOnly Secure SameSite cookie, 8-hour expiry, D1 revocation and exact Origin guard remain in place.
- Images are explicitly unsupported in this release. History is tab-local. All AI text is rendered as textContent.

## Verification

22 Node tests passed: existing auth/CSRF, cookie expiry/revocation, body/key validation, fixed request shape, daily/minute quotas, atomic concurrency, abort/error handling, and mocked DOM/MediaRecorder/SpeechSynthesis lifecycle. Node tests use synthetic keys and stub upstream fetches; no real service usage.

Wrangler 4.156.0 compiled the Functions locally using the existing offline cache. The generated route list includes only the existing routes plus the already established My Chat paths; editable source under `functions/_lib/my-chat-ui` is not a public static UI directory.

Actual browser UI rendering and physical microphone/speaker tests remain pending. Existing browser verification restrictions were not bypassed. Model availability, key permissions, account credit and live API response behavior are unverified until an authorized real request is made.

## Official references checked

- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/guides/speech-to-text (recommends gpt-transcribe; older transcription models deprecated)
- https://developers.openai.com/api/docs/guides/text-to-speech (legacy Speech API models scheduled for retirement; no new integration with those models)
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis


## Model, session and local history update (2026-11-03)

Causes: the selector had one option, chat requests omitted the model, and the
server fixed gpt-5.4-mini. Session checks treated network errors like revocation,
clearing the temporary key. Keys and conversations were deliberately memory-only.

This update adds a validated native selector (default unchanged), a retryable
fail-closed session state, opt-in fixed 30-day sessions, encrypted runtime Secret
support, and browser-local history. Existing eight-hour sessions are not extended.
No new D1 tables are needed. Other toolbox applications are unchanged.

Text model allowlist, verified against official model pages on 2026-11-03:
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-6.1-sol

All use Responses, text/image input and web search; Sol uses reasoning low,
others none. The existing 1200 output-token limit and quotas remain; reasoning
consumes this budget. Model availability and price depend on the OpenAI project.
No live paid model calls have been made to verify account access.

The approved MY_CHAT_OPENAI_API_KEY must be entered directly into Cloudflare:
Workers & Pages > silver-computing-machine > Settings > Variables and Secrets >
Production > Add. Set that name, paste the existing key, select Encrypt, Save.
Do this before deploying the new code. Never put the value in Git, chat, local
configuration, CLI arguments, screenshots, or browser persistent storage.
https://developers.cloudflare.com/pages/functions/bindings/#secrets

The authenticated session endpoint exposes only a boolean configured flag. The
server prefers the Secret, while an absent Secret permits the existing optional
memory-only key. Malformed configured Secrets fail closed. Removing/replacing
this Secret and redeploying disables/changes the shared server key; clearing the
temporary key in the UI does not remove it. Logout revokes the browser session,
not the server key. Anyone authenticated can incur charges under existing limits.

The unchecked 30-day option creates a signed HttpOnly Secure SameSite=Strict
cookie backed by the same revocable D1 row. Expiry does not slide. The login
username my-chat helps password managers distinguish records, but does not
provide authentication or guaranteed same-host autofill isolation.

History uses localStorage my-chat.history.v1, read only after successful session
verification, with strict shape validation and safe rendering. Only titles,
message text, safe citations and generated PNG outputs are saved. Credentials,
original uploads, microphone recordings and speech audio are excluded. Key-like
text is redacted. History is unencrypted browser-local data, not a security
boundary against same-origin scripts or people accessing the browser profile.
No cloud synchronization or separate history upload. Subsequent conversation
requests may include restored recent messages under the existing context limit.

Caps: 4 MiB (UTF-16 estimate), 100 conversations, 2000 messages; no automatic
expiry or trimming. Quota/corruption/disabled storage produces visible warnings
and preserves prior data. Explicit delete is separate from logout. Browser-data
clearing removes history. Cross-tab changes stop saving until reload to avoid
blindly overwriting another tab's changes.

Publication approved by the user after local review. Public GitHub checks for fa2a033 showed
Cloudflare Pages in_progress, while other checks succeeded. The production
unauthenticated page returns 401 but does not show the phase-2 worker-src CSP.
The prior rollout could not be certified complete. A single normal push of this
revision starts a distinct deployment; verify its own status and production output.
Do not cancel or repeatedly retry old deployments to poll their status. Authenticated Cloudflare/Platform browser inspection and real device
UI/microphone tests are unavailable in the currently supported workflow.
