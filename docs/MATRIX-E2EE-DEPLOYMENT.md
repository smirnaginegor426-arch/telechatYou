# Matrix E2EE deployment for TeleChat You

## Target architecture

- Keep the existing TeleChat You API, MySQL/TiDB database, chat routes and old message history unchanged.
- Run a dedicated Matrix homeserver (Synapse) as a separate service with its own persistent database and media store.
- Serve the Matrix Client-Server API over HTTPS.
- The TeleChat web client uses the existing `matrix-js-sdk` dependency and its Rust/WASM E2EE engine. Matrix accounts are separate from TeleChat accounts in this beta; account linking is a later phase.
- Do not point TeleChat users at a random public homeserver for sensitive conversations. Choose and control the homeserver first.

## Before deployment

1. Choose the permanent homeserver server name/domain. Synapse's `server_name` determines Matrix IDs and cannot be changed after setup, so decide this before creating user accounts.
2. Choose a host that can run a persistent Synapse service and PostgreSQL. For production, do not use SQLite; it is intended for testing.
3. Configure HTTPS/TLS and the Matrix client API endpoint. Verify that browser CORS / client discovery is correct for the chosen URL.
4. Disable public self-registration (`enable_registration: false`). Create only test users from the server administrator's trusted CLI or admin API. Protect and never publish the registration shared secret and admin credentials.
5. Configure persistent backups for the Synapse database, media store, and server signing key. Document who can restore them.
6. Keep federation off initially unless it is explicitly required and reviewed. A private, same-homeserver test pilot is simpler.

Official references:
- Synapse installation and server-name choice: https://element-hq.github.io/synapse/latest/setup/installation.html
- Synapse configuration, including registration controls: https://element-hq.github.io/synapse/latest/usage/configuration/config_documentation.html
- Matrix JavaScript SDK and Rust/WASM E2EE initialization: https://github.com/matrix-org/matrix-js-sdk

## Connect TeleChat You

1. Set the public build-time variable `VITE_MATRIX_HOMESERVER_URL=https://YOUR-TRUSTED-MATRIX-HOST` in the frontend build environment (not in the browser login form).
2. Trigger a new frontend build/redeploy. The app intentionally disables Matrix login while this variable is empty or invalid. In production, the URL must use HTTPS.
3. Open Settings → Account → Сквозное шифрование (or `/encrypted`). Confirm that the displayed homeserver exactly matches the one you deployed.
4. Create two separate Matrix test accounts and log in from two distinct browser profiles/devices. The passwords must be Matrix-only, not TeleChat You passwords.
5. Create an encrypted room, invite the other test account, confirm that both devices see the encrypted-room state, then send non-sensitive test strings in both directions.
6. Verify that the other side decrypts the messages and that the homeserver stores encrypted event payloads, not message bodies in clear text. Repeat after refresh/relogin. Inspect failed-decryption behavior instead of treating ciphertext placeholders as delivered messages.
7. Test denied login, disconnected network, second device, room invitations, unverified devices, session logout, and key recovery before any real use.

## Required next security work before general rollout

- Implement and test Matrix device verification UX using SDK crypto APIs; show whether every recipient device is trusted. The current beta has not completed that workflow and should not be used for sensitive conversations.
- Add secret storage/key-backup setup with safe recovery flows. Do not write the recovery key to TeleChat's server or log it.
- Encrypt media in the client before uploading; the existing TeleChat attachment pipeline uploads bytes before the message is sent and is not E2EE.
- Keep search, previews, reply previews, pinned text, notifications, and message editing/deleting local to the client or redesign each one so the TeleChat backend never receives plaintext.
- Add a proper account-linking model only after Matrix accounts and TeleChat IDs can be bound safely. Do not merge passwords, session tokens, or private keys between systems.
- Add a verified two-device end-to-end test suite and independent security review.

## Compatibility / rollback rule

The Matrix pilot is isolated at `/encrypted` and `/settings/e2ee`. Do not change the existing `messages.send`, `messages.list`, storage API, legacy screens or existing message rows as part of Phase 1. If Matrix is unavailable, show an error in the encrypted section; never silently send that content through the old plaintext API. Rolling back the Matrix UI should not require a data migration of old chats.
