# TeleChat You security and E2EE plan

## Current status

This repository is a web messenger served inside the Android WebView. HTTPS is provided by the hosting platform in production, but HTTPS alone is not end-to-end encryption.

Existing protections observed during the audit:
- User passwords are hashed with scrypt and a per-password random salt.
- Session tokens are random and only an HMAC-SHA-256 hash is stored in the database.
- Session cookies are HttpOnly, SameSite=Lax, and Secure except for localhost development.
- Uploaded-file access is checked per account: owner, current members of chats containing the attachment, recipients of shared sticker-pack manifests, profile avatars and eligible group/public-channel avatars. Signed media URLs use the same authorization helper.
- Private file responses are marked no-store to avoid retaining chat media in the browser cache after access changes.
- Sending a message with an attachment is rejected if the sender cannot already read that file.
- Login attempts are rate-limited by source hint and username.
- Server responses now include clickjacking, MIME-sniffing, referrer, permissions and base/form policy headers; API responses are no-store.
- Cross-origin API writes with a mismatching Origin or Sec-Fetch-Site: cross-site are rejected.

## Important current limitation

Messages are currently persisted in `messages.body` as ordinary text. Server-side message search uses SQL `LIKE`, and chat previews/replies/features read message bodies. Message attachments are also uploaded before client-side encryption. Therefore **TeleChat You does not currently have end-to-end encrypted messaging**. Do not advertise it as E2EE yet.

## Selected implementation and E2EE rollout plan

The Matrix client SDK is already a project dependency (`matrix-js-sdk` 44.0.0). The experimental screen initializes Rust/WASM crypto with `initRustCrypto()`, which uses the browser IndexedDB store by default. Its access token is stored only in `sessionStorage` for the current browser session; the password is never stored. This is a pilot foundation, not yet a complete integration of existing TeleChat accounts.

Implement in stages; do not encrypt only one field or use a custom static shared-key scheme and call it secure.

1. **Selected protocol and threat model**
   - Use the existing pinned `matrix-js-sdk` package and its Rust/WASM E2EE implementation. Do not implement Olm/Megolm or key exchange manually.
   - The experimental UI currently connects to a separately configured Matrix homeserver; TeleChat You's own API and legacy chat database are not used as a substitute homeserver.
   - The homeserver URL is build-time public configuration (`VITE_MATRIX_HOMESERVER_URL`) and must be HTTPS in production.
   - Before launch, document key verification, device replacement, account recovery, lost-device and multi-device behavior.

2. **Device identities and key distribution**
   - Each device generates private keys locally using a cryptographic library.
   - The server stores only public identity/prekey material and routes encrypted key bundles.
   - Provide device verification/fingerprint comparison to detect key substitution.
   - Never send private identity keys to the API or store them in plaintext on the server.

3. **Opt-in Matrix pilot rooms, then chat integration**
   - The experimental screen can connect to a configured Matrix homeserver and create a private room with `m.room.encryption` set to `m.megolm.v1.aes-sha2`.
   - Next, verify the room and encrypted event flow between two different Matrix accounts/devices. Do not infer that a room is fully verified merely because creation succeeded.
   - Only after that test should we add account linking and a new-chat choice for Matrix E2EE. Existing chats and history remain on the current TeleChat backend and must keep working unchanged.
   - Matrix E2EE messages must travel through Matrix APIs, never through the existing plaintext `messages.send` API.

4. **Features that need E2EE-aware redesign**
   - Search becomes device-local; the server cannot SQL-search ciphertext.
   - Chat previews, replies, pinned message content and notifications must avoid server-side plaintext.
   - Photos, files and voice messages must be encrypted locally before upload, with a separate random content key delivered inside the encrypted message.
   - Group encryption needs a group protocol and explicit membership/key rotation handling; it is a later stage.
   - Forwarding, edits, deletes, polls and sticker packs must preserve encrypted-message semantics instead of copying plaintext.

5. **Verification and rollout**
   - Add protocol test vectors and tests for tampering, wrong keys, replay, concurrent sends, key rotation and device loss.
   - Use test accounts on separate devices and verify that the database stores only ciphertext.
   - Run a security review before enabling by default.
   - Keep HTTPS and server security controls even after E2EE ships.

## Web client limitation

A web application downloads JavaScript from its hosting server. A compromised host could serve modified client code that steals plaintext or private keys, even if the normal message protocol is E2EE. For stronger guarantees, key verification and a signed/trusted native client distribution are important parts of the threat model.
