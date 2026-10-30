# My Chat feature expansion: phase 1 release

Reviewed against official documentation on 2026-10-30. Based on live commit `1aec52d744ec5cefdb1cf49bf76c6cfeb6ef6985`. Phase 1 publication was authorized after review.

## Capability map and order

| Function | Status and first version | Prerequisites / remaining work |
|---|---|---|
| Text, summarization, translation, drafting, coding answers | Already live; unchanged GPT-5.4 mini | Existing common key, valid billing/model permission |
| Turn-based speech input and device speech output | Already live | Microphone permission and device/browser support |
| Image understanding | Phase 1 implementation | One PNG/JPEG/WebP selected by user, converted locally to PNG with maximum edge 1024px; server caps edge 1536px and file 2MiB. Uses GPT-5.4 mini `input_image` with low detail. Fine OCR is not promised. |
| TXT / Markdown / CSV / JSON reading | Phase 1 implementation | UTF-8 text up to 24KB and 8000 characters; total context still capped at 16000 characters. Sent inline, no Files API upload/storage. No code execution. |
| Web search with citations | Phase 1 implementation | Responses `web_search`, low search context, required tool selection, maximum one built-in tool call. Citation spans are rendered as visible clickable links. No arbitrary server URL fetch. Cannot combine with attachments in one request. |
| Image generation | Phase 1 implementation | Fixed `gpt-image-2.5-flare`, one 1024x1024 PNG, low quality, auto moderation. API organization verification/model access may be required. No new credential or D1 migration. |
| Image editing | Phase 1 implementation | Same image model and bounds, one reference image with prompt. JSON `images:[{image_url:dataURL}]` goes to fixed `/v1/images/edits`. Masks, multi-image composition and exact pixel preservation are not implemented. |
| PDF / Office documents | Deferred, not exposed as usable | Official file inputs support document processing, but page/token limits and binary parsing must be designed first. Files API persistence would require explicit storage/deletion handling; phase 1 does not use it. |
| Natural API speech synthesis / realtime interruption | Deferred, existing device reading remains | Legacy Speech API models have scheduled retirement. Realtime needs an ephemeral session or server-owned transport, session-duration/cost enforcement, cleanup on logout, CSP/network changes and device tests. No temporary credential is created now. |
| Data analysis, charts and downloadable documents via Code Interpreter | Deferred | Hosted container/tool fees, file lifetime and download/deletion handling. Would need a separately bounded tool workflow. No container created. |
| Persistent file knowledge / retrieval | Deferred | Vector-store uploads, storage fees, retention and explicit deletion. No vector store created. |
| Video / extended background jobs | Not included or marked available | Must first verify current account/API availability, job lifecycle, output retention and cost controls. |
| Admin APIs, account/user management, autonomous external actions | Outside this personal chat request | No implementation or permission changes. |

## Consent, storage and cost controls

The feature picker defaults to existing text chat. Selecting a file only reads/converts it locally. Attachments, search and image actions require the visible send/fee checkbox before any network request; the server also requires consent. Consent resets when the feature or attachment changes and after successful use. Attachments are sent only on that turn; future turns carry the text answer and attachment name, not the original file.

The common key still exists only in tab memory and request processing. No key persistence, new secret, permission change, automatic key test or real paid API call was added. `store:false` remains on Responses requests. This does NOT promise zero OpenAI-side retention: the UI states provider retention follows the account's terms/settings. No `/files`, vector-store or container endpoints are called.

Existing authentication, signed session cookies, Origin checking and D1 revocation remain. Destinations are fixed to `api.openai.com/v1/responses`, `/audio/transcriptions`, `/images/generations`, `/images/edits`; redirect following remains disabled. Image input URLs must be inline PNG data; remote URLs, SVG and user-specified upstream URLs are not passed through.

Existing limits: 6 requests/minute/session, 100 requests/UTC day site-wide, one concurrent request/session. Added sublimits reuse `my_chat_api_control`: image generation and edits share 10 requests/day; web search 30/day. Failed attempts can consume quota. Image requests time out at 180 seconds with a 195-second lease; other upstream calls retain the 60-second timeout. No automatic retries. Cancellation may still be billed.

These are bounded request/token/size controls, not a guaranteed monetary spending cap. Web search is currently $10/1000 calls plus model/search-content tokens, so the search-call component is $0.01 per enabled request, excluding tokens. Image pricing is token-based; the documented GPT Image 2.5 rates include $30/M image output tokens, $8/M image input tokens and $5/M text input tokens. Quality/size affect totals. UI uses fixed low-quality square output and states additional image cost rather than a guaranteed per-image price. Billing and model eligibility have not been checked for this user.

## Verification and publication boundary

35 Node tests pass, including consent gating, fixed image parameters, bounded attachments, rejection of remote image URLs, safe citation links, feature subquotas and original chat/voice/auth regression tests. Local workerd/Miniflare exercises actual Request validation, D1 withSession SQL, PNG data validation, generation/edit/vision/search payload processing and quota enforcement, with every provider response mocked. Wrangler Pages Functions compilation passed.

No real image generation, file upload, search, new token or paid test was performed. Browser rendering, actual image canvas decoding, real-device recording, model availability and real provider responses remain unverified. Existing browser verification restrictions were not bypassed.

Security review completed; release approved. No D1 statement, new binding, secret or Cloudflare plan change is needed for phase 1. Publication uses the existing GitHub/Cloudflare Pages flow. Later phases are proposals, not completed functionality.

## Official references

- Image understanding: https://developers.openai.com/api/docs/guides/images-vision
- File inputs and PDF handling: https://developers.openai.com/api/docs/guides/file-inputs
- Web search and citation requirements: https://developers.openai.com/api/docs/guides/tools-web-search
- Exact model ID `gpt-image-2.5-flare`: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
- Image generation/editing and model verification: https://developers.openai.com/api/docs/guides/image-generation
- Image edit JSON schema: https://developers.openai.com/api/reference/resources/images/methods/edit
- Pricing: https://developers.openai.com/api/docs/pricing
- Realtime: https://developers.openai.com/api/docs/guides/realtime
- Legacy speech API retirement: https://developers.openai.com/api/docs/guides/text-to-speech
- Hosted data analysis: https://developers.openai.com/api/docs/guides/tools-code-interpreter
- Data controls: https://developers.openai.com/api/docs/guides/your-data

Review hardening: server rejects credential-like text in messages, text attachments and image prompts; PNG output is bounded and its signature/dimensions validated. Frontend accepts only inline PNG output and HTTP(S) citation links without embedded credentials. Stop/logout invalidate late attachment reads. Image pixels are not scanned for secrets; users must select appropriate images. No application logs include keys, bodies or provider error bodies.
