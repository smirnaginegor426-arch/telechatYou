# TeleChat You — security and Matrix E2EE rollout

## Existing TeleChat You security controls

The current app and API have the following protections in the repository:
- Account passwords are hashed with scrypt and per-password random salts.
- Database sessions store HMAC-SHA-256 hashes of random session tokens.
- Session cookies are HttpOnly and SameSite=Lax, and Secure outside localhost development.
- Login attempts are rate-limited by source hint and username.
- API responses are no-store and include security headers; cross-origin API writes with a mismatching Origin or cross-site Fetch Metadata are rejected.
- Uploaded-file routes and signed media URLs check account/chat access; attachment sends verify the sender can read the file.

These controls reduce several risks but do not make all parts of the messenger secure by themselves. Hosting, TLS, account recovery, access control, device security and dependency updates still matter.

## Critical limitation of existing chats

The original TeleChat You chat stack stores message content in `messages.body` as ordinary text and uses the backend for previews, replies and SQL search. **Those existing chats are not end-to-end encrypted.** They remain online and unchanged during the migration; do not mark their history as encrypted or silently migrate it.

## Matrix integration now staged in the current client

The current main app includes an experimental `/encrypted` screen, linked from Settings → Account → Сквозное шифрование, and pins `matrix-js-sdk` to a specific version in the npm dependency tree. The homeserver address is intentionally controlled by `VITE_MATRIX_HOMESERVER_URL`, not entered freely on the login screen; when it is unset, login remains disabled.

The new section is separate from the original TeleChat API. It:
- defaults to the public Matrix.org homeserver over HTTPS when `VITE_MATRIX_HOMESERVER_URL` is unset; the owner can override it with a trusted HTTPS homeserver at build time. An invalid explicit override disables login rather than silently switching destinations;
- connects directly from the browser/WebView to a Matrix homeserver over HTTPS (localhost HTTP is allowed for development);
- uses Matrix account credentials, separate from the TeleChat You username/password;
- initializes the Matrix SDK's Rust/WASM E2EE support;
- stores the short-lived Matrix session token in sessionStorage rather than sending it to the TeleChat API;
- stores Matrix cryptographic state in the browser's IndexedDB, namespaced by Matrix account and device;
- lists encrypted Matrix rooms and only attempts to send text when the selected room has an encryption state event;
- enables the Matrix SDK policy that blocks sharing room keys with unverified recipient devices by default;
- does not yet implement TeleChat You device-verification UI, so test accounts must establish trust out-of-band with a compatible Matrix client. Do not assume devices have been independently verified.

Only Matrix rooms created/received as encrypted rooms are shown in this beta section. The current UI must not be used for sensitive or secret conversations until homeserver deployment, two-device tests, and device verification/key recovery are complete. A separate Matrix account is required. The default matrix.org service is free to try, but its operator can still observe account/room membership and activity metadata even when encrypted room message bodies are protected. This is not an automatic bridge between existing TeleChat You accounts and Matrix IDs.

## Beta limitations — do not describe this as a finished security feature yet

Before using the new screen for sensitive conversations, the following are still required:
1. Complete Matrix device/identity verification UX in TeleChat You, including a user-visible way to start and finish verification and clearly show trust status.
2. Secret storage and encrypted key backup/recovery UX; test recovery after reinstall and when moving to another device.
3. Test the complete flow against two real Matrix test accounts on separate browsers/devices, including messages in both directions, wrong credentials, network loss, device replacement and missing room keys.
4. Verify the installed Android WebView's IndexedDB/WASM behavior with the released APK, not just desktop browser builds.
5. Choose a trusted Matrix homeserver. If `VITE_MATRIX_HOMESERVER_URL` is unset, the client uses `https://matrix.org`; the owner can override this at build time. The URL is configuration, not a secret. The current repository does not deploy a Matrix homeserver or automatically provision Matrix accounts from TeleChat You accounts.
6. Encrypt media locally before upload and handle attachments/voice, message previews, reactions, pins, notifications and local-only search. The first screen implements text-only encrypted messages.
7. Review hosting/CSP and supply-chain risks. Web E2EE cannot protect keys from malicious JavaScript delivered by a compromised site. Device verification helps with identity, but a compromised client can still expose plaintext on that device.

Do not silently fall back to plaintext if Matrix login, Rust crypto initialization, room encryption or key distribution fails. Existing TeleChat You chats should remain visibly distinct from the Matrix E2EE section.

## Recommended migration phases

- **Phase 0 — keep compatibility:** leave the original chats/API and legacy UI unchanged.
- **Phase 1 — isolated Matrix beta:** use the new Matrix section only for test accounts and encrypted Matrix rooms.
- **Phase 2 — trust and recovery:** add device verification, cross-signing/secret storage and tested recovery before inviting non-technical users.
- **Phase 3 — media and product integration:** encrypt file bytes on-device; decide how Matrix users map to TeleChat You accounts and how notifications, search, previews and exports should work.
- **Phase 4 — optional rollout:** use opt-in encrypted rooms, show encryption status prominently, and keep existing chat history labelled accurately. Any future account migration must be explicit and reversible; never re-label plaintext history as E2EE.

## Matrix SDK implementation notes

The Matrix JavaScript SDK uses the Rust Matrix crypto implementation via WebAssembly for E2EE. Its documentation warns against multiple concurrent MatrixClient instances sharing the same IndexedDB crypto store because the crypto stack is not thread-safe. The current integration keeps one active client per app runtime, uses a stable database prefix by Matrix user/device, and removes component event listeners when the E2EE screen unmounts. The SDK's verification, backup, media and multi-device flows still need end-to-end testing before production use.
