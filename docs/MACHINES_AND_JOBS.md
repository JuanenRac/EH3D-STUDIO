# Machines and jobs

The page **Machines and jobs** (group Services) uses the plugins, the generic queue and the stream of events of EH3D-SERVER (`/api/v1/plugins`, `/work/...`, `/events/stream`, `/notifications`; `docs/MACHINE_PLUGINS.md` of that repository). Code: `src/pages/WorkPage.tsx`, `src/components/AtcEditor.tsx`, `src/services/work.ts`, `src/services/atc.ts`, `src/services/events.ts`.

## Tabs

* **Jobs:** the queue and history with filters (machine, state, mine, words), progress, position in the queue and the history of each job. Start, stop and delete ask twice; hold and resume are offered only when the plugin can hold. Below it, the form to prepare a job: the machine, a name and the request of the plugin as JSON (a template per kind). A refusal `bad_rack` is told with the place and the tool.
* **Machines:** the machines of every plugin with their state and job, the safe actions of the next section (a stop button for a busy machine that cancels its job, asks twice), the plugins, and, for an administrator, adding and removing the machines of a plugin that keeps its own (`demo`).
* **Nodes:** the feeder and head nodes of the pick-and-place machines (next section).
* **Printers:** the 3D printers the server watches, read only (below).
* **Live events:** the stream, with filters by machine, job and kind of event.
* **Tool places:** the table tool to place of the `rack` of the second version of the request (`docs/ATC_CHAIN.md` of the server). It warns, as BUNGARD-GUI does, of a tool without a place, a place shared by two tools and a place the machine does not define, and finds before sending the other refusals of the server (the test pin, the tool in the chuck, `first`, the number of places). The result goes into the request of the job.
* **Notifications:** from `/notifications` and from the stream; mark one or all as read.

## The stream

`EventSource` cannot set a header, so each connection asks for a one-use ticket (`POST /tickets`). When it ends, the feed waits 1, 2, 4... up to 30 seconds, asks for a new ticket and connects again with `last_event_id`; a `hello` that says `resync`, or an event `resync`, makes the page read the lists again. After eight failures in a row it stops and offers a button. There is one stream per tab, opened while a page that follows it is shown, so the limit of clients of the server (`429 too_many_clients`) is respected. The filters are applied in the page.

## Safety of the machines of the plugins

The plugins `laser`, `pnp`, `pcb`, `cnc`, `gerber`, `cam`, `printer3d`, `vision` and `cad` have only run against simulators. Code: `src/services/safety.ts` (the rules) and the **Machines** tab of `src/pages/WorkPage.tsx`.

* **Simulator only:** a machine whose `detail` says `simulator_only` or `evidence: "simulator"` (or whose plugin does so in its capabilities) wears the badge *SIMULATOR ONLY*; no machine is shown as proven on hardware.
* **Interlocks in red:** `latched`, `estop_latched` and an alarm (`alarm`, or the state word `Alarm` of a router) are badges next to the state; a machine that says its queue starts by itself (`auto_start_queue`) is called out too. The other short facts of `detail` are listed under the name.
* **Emergency stop:** for an operator (`jobs:cancel`), one touch and no question. A router and a 3D printer stop by `POST /work/machines/{id}/emergency-stop` (and latch); any other machine stops by cancelling its job, so it is offered only while a job runs. It is not offered for a machine that is already held. A stop that gets no answer is sent once more.
* **Release:** for an administrator (`machines:manage`), only for a held machine whose plugin has a route (`release` for a router and a printer, `laser/release` for a laser), and the button asks twice.
* **A person starts a print:** a print of a 3D printer waits in the queue with the note that a person must start it; the start asks twice like every start. Studio never switches a queue to start by itself.

## The nodes of the pick-and-place machines

The tab **Nodes** (`src/components/PnpNodes.tsx`, rules and client in `src/services/pnp.ts`) lists `GET /api/v1/pnp/nodes`: name, id, kind (feeder or head), machine, address, whether the node has a token (the server sends `********`, which Studio never shows), its health (`unknown`, `disabled`, `ok`, `warn`, `fail`, `safe`, `unreachable`, `refused` or `silent`), whether it is ready (only `ok` and `warn` are), the last error of its poll, the counts the node said last (feeders online, low, empty and faulted; nozzles, pump and faults of a head) and the good and failed polls. The server asks the nodes on a timer; Studio never reaches a node by itself, it asks the list again when the websocket of the server (`/api/v1/events`, with a ticket) sends `{"type":"pnp_node","id","health","ready"}`, and mends that connection with a wait that grows from 1 to 30 seconds. With the switch `pnp_nodes_enabled` off the server answers `501 pnp_nodes_off` and the tab says so.

* A node goes to its safe state when the server does not ask it for `link_lost_ms` (a head, 2000 by default; a feeder `server_lost_ms`, 15000). The row of each node says that time, and when the server asks it too slowly (`warnings` and `poll_too_slow` of the list) the tab shows a box with the interval, the time and what to change (`pnp_node_poll_s`, 1 by default).
* A viewer reads. An operator (`jobs:prepare`) can ask a node now (`POST /pnp/nodes/{id}/poll`; not offered for a node that is switched off). An administrator (`machines:manage`) registers (`POST`), changes (`PUT`) and removes (`DELETE`) nodes; saving and removing ask twice.
* The form checks the id (lower-case letters, digits and hyphens, up to 32), the name (up to 64 characters), `host:port` and a token with no spaces before it sends anything; the server judges again (`bad_pnp_node`, `pnp_node_exists`, `pnp_nodes_full`). A token left empty in the form of a node that has one is sent as `********`, which the server reads as "keep it".
* Everything seen here was seen against a simulator: nothing has run on a real feeder or head.

## The 3D printers, read only

The tab **Printers** (`src/components/Printers.tsx`, rules and client in `src/services/printers.ts`) shows `GET /api/v1/printers` (contract `eh3d.printers.status/1`): for each printer its health, state, temperatures with their targets, progress, time left (marked when the server estimated it), layers, job and whether it has a camera; Studio never receives the access code or key of a printer, nor a camera picture or address. It has no control at all: no button, field or form that reaches a printer, and the client only knows how to `GET` the list. Printers are registered on the server (`docs/API.md` there), not here.

* **Warnings:** a box lists what a person should see now (firmware stopped, error, failed print, alerts of the printer, paused, access refused, certificate not trusted, answer not understood, no answer, old information). What appears while the tab is open is also told in the line of news, a finished print too, with the sound of the alerts when they are on.
* The list is asked again at the refresh rate of Studio while the tab is shown. A value the printer did not say, or an impossible one, is shown as unknown, never as zero; an answer that is not the contract is an error, not an empty list. When the server stops answering, the last list stays with a line that says it is old.
* With `printers_enabled` off the server answers `501 printers_off` and the tab says so.
* Everything seen here was seen against a simulator: nothing has run on a real printer.

## The hash and the authorization of a job

Every job of the queue carries `toolpath_sha256`, the hash of what it will do, and `authorization` (who, when and for which hash). The queue shows the short hash and a badge (not authorized, authorized, or out of date when the hash changed after the authorization); the full hash and who authorized it are in the detail of the job. A person with the scope `jobs:authorize` (operator or above) authorizes a queued job with `POST /work/jobs/{id}/authorize` and a second touch, and the start sends the same hash (`POST /work/jobs/{id}/start` with `{"toolpath_sha256"}`), so the server refuses with `409 stale_authorization` a job that is no longer the one that was shown. After `stale_authorization` or `authorization_required` (while `work_require_authorization` is on) the job opens with its present hash; `pnp_node_not_ready` says that a node of the machine is not ready. A job without a hash starts with an empty body, as before.

## Orders that set a machine going

- Start, confirm, resume and "go on" are sent once: the same order is not sent again while it is on its way, nor for a second after the server takes it. A stop is never held back.
- The second click of a double click does not answer "Sure?", does not start from the summary and does not release the latch of a machine.
- While the last request for a job or for the list failed, Start, Confirm, Resume and "go on" are off. The stop stays.
- An order with no answer (or a 502 or 504) says that it may have arrived; a stop that did not get there says that it has not reached the server.
- A G-code program the server refuses (`422 bad_gcode`) is shown with the line and the reason of the server.

## Roles

A viewer sees; an operator prepares, starts, holds and cancels; an administrator also manages the machines of the plugins.

## What has been tried

Against a stand-in of the server and a false `EventSource`. Never with a real machine.
