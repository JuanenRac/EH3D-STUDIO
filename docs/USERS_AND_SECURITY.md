# Users, roles and security

The page **Security** (group Account) uses the single login of EH3D-SERVER (`/api/v1/auth/...`, `docs/AUTH.md` of that repository). Code: `src/pages/SecurityPage.tsx`, `src/services/authsvc.ts`, `src/services/permissions.ts`.

* **Session:** who the login is, its application, scopes, last use and expiry; renew it or sign out everywhere (people only; a token of a program has no login).
* **Open sessions:** the caller's, or everybody's for an administrator; closing one asks twice. The id of a session is not a token.
* **What each role may do:** a table that comes from the same rules the pages use.
* **Policy of the server** (administrator): every switch with its value and whether it is as strict as recommended, the ones that deserve a look first. No secret is ever in it. The switches the server lets change while it runs (`editable`: `url_token`, `audit_denials`, `design_run` and the limits of the logins and of the passwords) have a button, or a number to type and Save; when the server answers that the new value is looser than recommended (`409 weak_confirm_required`) the page asks again and sends the change with `confirm_weak`. The other switches are changed in `server.cfg` and the server is started again.
* **Audit** (administrator): the lines of `GET /api/v1/audit` with the filters by person and by event, the newest first, with the other fields of each line written as `key=value`. When the audit file is switched off on the server the page says so.
* **Keys and TLS fingerprint** (administrator): the tokens of the programs by identifier, name, role, creation, last use and expiry (never their secret), and the SHA-256 fingerprint of the certificate that `tls_cert_file` names in `server.cfg` when the server has one.
* Users and tokens stay in the page Users and tokens.

## Sign-in

Studio signs in with `POST /api/v1/auth/login` and `app: "studio"`, so the login is listed with its application and the audit says where it came from.

## What has been tried

Against a stand-in of the server.
