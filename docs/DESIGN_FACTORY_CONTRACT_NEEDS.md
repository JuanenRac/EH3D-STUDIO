# What the server would need

Studio does not invent routes. These are the ones the pages are ready for and EH3D-SERVER does not have yet.

## Design and factory

`POST /api/v1/apps/pcb/jobs` (operator, scope `jobs:prepare`) with `{"kind": "check" | "bom" | "fabpack" | "panel", "project": "<id>", "file": "<board file of the project>", "options": {}}`. The answer is a job of the queue (`WorkJob`), and the report is written to the project as a file (`reports/<kind>.json`, the JSON of `phoenix <kind>`), so it appears in the explorer and in the page Design and factory. The job ends `done` or `failed` with the message of the tool. The request is built by `designRequest()` in `src/services/design.ts`; the constant `DESIGN_RUN_AVAILABLE` turns the buttons on.

## Security

* `GET /api/v1/audit?who=&event=&from=&to=&limit=` (administrator): the lines of the audit (`at`, `event`, `who`, `app`, `detail`, `ip`), never a password or a token.
* `GET /api/v1/auth/keys` (administrator): the identifiers and ages of the keys, never their value; and the SHA-256 fingerprint of the certificate when the server terminates TLS.
* `PUT /api/v1/auth/policy` (administrator): change one switch at a time, answering the new policy; Studio would ask for a confirmation before a switch becomes less strict.

## Projects

* A route for the quota (`project_max_mb`, files and projects of the application, and what is used) so the page can show the limit and not only the use.
