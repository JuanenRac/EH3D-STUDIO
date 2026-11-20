# Machines and jobs

The page **Machines and jobs** (group Services) uses the plugins, the generic queue and the stream of events of EH3D-SERVER (`/api/v1/plugins`, `/work/...`, `/events/stream`, `/notifications`; `docs/MACHINE_PLUGINS.md` of that repository). Code: `src/pages/WorkPage.tsx`, `src/components/AtcEditor.tsx`, `src/services/work.ts`, `src/services/atc.ts`, `src/services/events.ts`.

## Tabs

* **Jobs:** the queue and history with filters (machine, state, mine, words), progress, position in the queue and the history of each job. Start, stop and delete ask twice; hold and resume are offered only when the plugin can hold. Below it, the form to prepare a job: the machine, a name and the request of the plugin as JSON (a template per kind). A refusal `bad_rack` is told with the place and the tool.
* **Machines:** the machines of every plugin with their state and job, the safe actions of the next section (a stop button for a busy machine that cancels its job, asks twice), the plugins, and, for an administrator, adding and removing the machines of a plugin that keeps its own (`demo`).
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

## Roles

A viewer sees; an operator prepares, starts, holds and cancels; an administrator also manages the machines of the plugins.

## What has been tried

Against a stand-in of the server and a false `EventSource`. Never with a real machine.
