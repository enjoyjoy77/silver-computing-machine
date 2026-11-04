# My Chat browser history update (local; publication held)

The production baseline is 3dd68290731f450ac8b589d24368d8564b8b00af.
The unrelated photo-block main commit 763e9edc58a68606fa0377fd72b797c3592a453a
must be retained before any future My Chat publication. Root index.html is not edited here.

## Storage and migration

Runtime dependencies: native IndexedDB, Blob and Web Crypto only; history.js is
served through the same authenticated asset middleware. No network/sync service.
Database: my-chat-history, schema version 1, stores state and images. Conversation
metadata lives in state/current; generated PNGs are separate deduplicated Blobs.
App limits remain 100 conversations / 2000 messages, now 100 MiB of metadata plus
unique decoded image bytes rather than a 4 MiB UTF-16 Base64 JSON snapshot.
Browser quotas, available disk space, private browsing, eviction and user clearing
site data can impose tighter limits. No silent expiry, trimming or quota expansion.

The existing my-chat.history.v1 localStorage string remains untouched throughout
migration and ordinary use. On first verified login it is validated and copied in
one transaction with phase=pending. A separate read-back verifies all image hashes
and the complete reconstructed conversation content before phase=ready is committed.
Interrupted pending migrations retry verification on reload. Any validation,
verification, storage or quota failure leaves legacy data intact and shows a warning;
legacy data can be displayed read-only if valid. Failed IndexedDB access never falls
back to unsafe localStorage writes. Browser-local data is not encrypted at rest by
this application; same-origin scripts and access to the browser profile can read it.

Every canonical save/clear uses a readwrite transaction covering both stores.
It compares the loaded revision inside that transaction. A stale writer is rejected,
leaving its unsaved UI content and previously committed history intact. No dependency
on Web Locks or a non-atomic fallback. Signals and authenticated lifecycle generation
are checked before writes and transaction completion; logout/expiry abort pending work.
A local queue and generation prevent an older queued save from undoing a clear.

Each state records a SHA-256 fingerprint of the legacy snapshot. Old-version tab
changes are preserved in localStorage and reported; they are never automatically
merged/imported over new history. Such a legacy conflict requires deliberate recovery
or clearing after preserving needed data; merely reloading does not merge versions.

Explicit delete-all first commits a deleted tombstone and empty canonical stores.
Only afterward does it remove the unchanged legacy backup. If backup removal fails
or an old tab writes again, the tombstone prevents automatic re-import and a warning
reports the remaining legacy data. No database deletion or version downgrade is used.

## Testing

Install test-only dependency from the pinned lockfile:

    npm ci --prefix tests/my-chat-storage-deps --ignore-scripts

Run:

    node --test tests/my-chat-history.test.mjs tests/my-chat-ui.test.mjs tests/my-chat-auth.test.mjs tests/my-chat-api.test.mjs tests/my-chat-documents.test.mjs
    node build-my-chat.mjs

fake-indexeddb 6.2.7 is test-only (Apache-2.0), pinned to registry.npmjs.org with
integrity metadata. It is not shipped to the browser. Storage tests use actual
IndexedDB transactions through the simulator, valid synthetic PNGs, fault injection,
concurrent writers, clear/save races, pending transaction cancellation, migration
read-back corruption and recovery. UI tests include real-module integration for
legacy A/B plus a new C, alongside isolated persistence adapters for UI-only cases.
No real history, credentials, original user files or paid API calls are used.

A fixed frontend snapshot and synthetic fixtures will be handed to independent
browser QA before publication. Simulator success alone is not real-browser proof.
