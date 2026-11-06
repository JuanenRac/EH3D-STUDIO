# Users, roles and security

The page **Security** (group Account) uses the single login of EH3D-SERVER (`/api/v1/auth/...`, `docs/AUTH.md` of that repository). Code: `src/pages/SecurityPage.tsx`, `src/services/authsvc.ts`, `src/services/permissions.ts`.

* **Session:** who the login is, its application, scopes, last use and expiry; renew it or sign out everywhere (people only; a token of a program has no login).
* **Open sessions:** the caller's, or everybody's for an administrator; closing one asks twice. The id of a session is not a token.
* **What each role may do:** a table that comes from the same rules the pages use.
* **Policy of the server** (administrator): every switch with its value and whether it is as strict as recommended, the ones that deserve a look first. No secret is ever in it. Studio only reads the switches: they are changed in `server.cfg` and the server is started again, because the server has no route to change them yet.
* Users and tokens stay in the page Users and tokens.

## Not available on this server

The audit log, the keys and the fingerprint of the TLS have no route yet. The page says so and has the filters of the audit ready, off. The routes that would be needed are in `DESIGN_FACTORY_CONTRACT_NEEDS.md` (section "Security").

## What has been tried

Against a stand-in of the server.
