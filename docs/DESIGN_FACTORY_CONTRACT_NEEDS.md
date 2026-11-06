# What the server gives Studio, and what is still missing

Studio does not invent routes. These are the ones the pages use for the design and factory work, the security and the quota; the server (EH3D-SERVER) has all of them, and the pages are written from its contract (`docs/openapi.yaml` of that repository). Nothing here has been tried against a running server yet.

## Design and factory (covered)

`POST /api/v1/apps/pcb/jobs` (operator, scopes `jobs:prepare` and `projects:write`) with `{"kind": "check" | "bom" | "fabpack" | "panel", "project": "<id>", "file": "<board file of the project>", "options": {}}`. The answer is a job of the queue (`WorkJob`, plugin `phoenix`), `running` at once and `done` or `failed` when it ends, with the message of the program in `message`. The report is written to the project as the file `reports/<kind>.json`, so it appears in the explorer and in the page Design and factory.

* The file is an envelope: `{"kind", "file", "ok", "exit_code", "timed_out", "truncated", "report", "text", "stderr"}`. `report` is the JSON the program wrote (`check`, `bom` and `panel` are run with `--json`); `fabpack` is a dry run and has only `text`, which is not a report. Studio takes `report` out of the envelope (`unwrapRun` in `src/services/design.ts`).
* Only `fabpack` takes options (`profile`, `lang`, `panel_boards`, `dnp`); the buttons send none.
* The run is off on the server by default and needs the program named in `server.cfg`; without that the route answers `501 design_run_unavailable`, and the page says so with the sentence of that refusal. The request is built by `designRequest()` in `src/services/design.ts`; the constant `DESIGN_RUN_AVAILABLE` turns the buttons on.

## Security (covered)

* `GET /api/v1/audit?who=&event=&since=&until=&limit=` (administrator): the lines of the audit, the newest first, with `at`, `event`, `who` and the other fields of the event; never a password or a token. Studio shows them in the page Security.
* `GET /api/v1/auth/keys` (administrator): the tokens of the programs by identifier, name, role, creation, last use, expiry and age, never their value; and the SHA-256 fingerprint of the certificate that the server names in `tls_cert_file` (the server does not terminate TLS itself, so it is the certificate of the proxy in front of it).
* `PUT /api/v1/auth/policy` (administrator): changes one switch at a time, answering the new policy. Only the keys in `editable` of `GET /auth/policy` can change while the server runs. A value looser than recommended is refused with `409 weak_confirm_required` unless the body says `confirm_weak: true`; Studio then asks the person again and sends the change with it. A key that cannot change, or a value that does not fit, is `422 bad_policy`.
* `POST /api/v1/auth/login` with `app: "studio"` is the sign-in of Studio.

## Projects (covered)

* `GET /api/v1/apps/{app}/quota`: the limits of the store (`project_max_mb`, `project_max_file_mb`, `project_max_files`, `project_max_projects`) next to what the application uses and, per project, the bytes and files left. Studio shows the limit next to the use in the detail of a project.

## Still missing

* A way to ask the server whether the design run is set up before the person presses a button: today the answer is the refusal `501 design_run_unavailable`.
* Options for `check`, `bom` and `panel`: the server accepts none, so the buttons send none.
