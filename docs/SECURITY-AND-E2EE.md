# TeleChat You security and E2EE plan

## Current status

This repository is a web messenger served inside the Android WebView. HTTPS is provided by the hosting platform in production, but HTTPS alone is not end-to-end encryption.

Existing protections observed during the audit:
- User passwords are hashed with scrypt and a per-password random salt.
- Session tokens are random and only an HMAC-SHA-256 hash is stored in the database.
- Session cookies are HttpOnly, SameSite=Lax, and Secure except for localhost development.
- Private uploaded files require an authenticated session.
- Login attempts are rate-limited by source hint and username.
- Server responses now include clickjacking, MIME-sniffing, referrer, permissions and base/form policy headers; API responses are no-store.
- Cross-origin API writes with a mismatching Origin or Sec-Fetch-Site: cross-site are rejected.

## Important current limitation

Messages are currently persisted in `messages.body` as ordinary text. Server-side message search uses SQL `LIKE`, and chat previews/replies/features read message bodies. Message attachments are also uploaded before client-side encryption. Therefore **TeleChat You does not currently have end-to-end encrypted messaging**. Do not advertise it as E2EE yet.

## E2EE rollout plan

Implement in stages; do not encrypt only one field or use a custom static shared-key scheme and call it secure.

1. **Protocol choice and threat model**
   - Select a maintained, audited protocol implementation with browser/WebView support, device identities, authenticated key exchange, forward secrecy and a ratchet.
   - Document key verification, device replacement, account recovery, lost-device and multi-device behavior before enabling it.
   - Do not invent a cryptographic protocol from low-level primitives.

2. **Device identities and key distribution**
   - Each device generates private keys locally using a cryptographic library.
   - The server stores only public identity/prekey material and routes encrypted key bundles.
   - Provide device verification/fingerprint comparison to detect key substitution.
   - Never send private identity keys to the API or store them in plaintext on the server.

3. **Opt-in one-to-one messages**
   - Start with newly created direct chats; keep existing history clearly labelled as legacy/non-E2EE.
   - Encrypt on the sender's device before calling the API; decrypt only on a recipient device.
   - The database and API should see ciphertext, message IDs, routing metadata and timestamps, not message text.
   - If a recipient does not have a verified compatible device/key bundle, fail closed with a clear UI state rather than silently sending plaintext.

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
