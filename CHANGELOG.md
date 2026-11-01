# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- **The stop button reaches the machine at once:** stopping an active job asks the server to stop the machine (`POST /machines/:id/stop`) instead of cancelling the job, and the camera and the live events ask for a one-use ticket instead of putting the token of the session in the address.

- **The status lights are checked in the CI** and the ones the evidence does not support are yellow.

- **The refusals of the server are written in the eight languages:** the login, the setup code, the password, the names, the ids, the jobs and the busy-server codes no longer show the raw code.
- **Machine ids and stations** are checked the way the server checks them (lowercase letters, digits and hyphens).
- **The last quality check** no longer shows `NaN %`, and the pages that reload when the machine changes do not paint the answer of the previous machine.

## [0.0.6] - Follow a stopped job without choosing the file and the switch for GRBL dollar lines

- **Go on from where a job stopped, without picking the file again:** a job that failed or was cancelled has a button "Go on from where it stopped" (drilling, routing and G-code) that asks the server for a new job made from the request it kept, with the holes, paths or lines already done left out; the new job opens ready, never started, and says which job it goes on from. A G-code program is no longer kept in the browser for this.
- **The $ lines of GRBL, per machine:** the form of a machine has, for an administrator and for the connections that take G-code, a safety switch that allows the `$` lines (`$H`, `$X`, `$G`...) in the G-code jobs of that machine; it is off by default, comes with a warning, is never copied to a copy of the machine nor carried by the export and import of machines, and the list of machines marks the ones that have it on.
- 5 tests more (73 in all), the new texts and the refusal `not_stopped` in the eight languages.

## [0.0.5] - The version shown in the page follows package.json

- **The version shown in the page is the one of `package.json`:** it was written by hand in the code and the footer and the About page said 0.0.2 in the version 0.0.4; now the build takes it from `package.json` (and a test checks it), so it cannot fall behind.

## [0.0.4] - G-code jobs, GRBL machines, pause and resume, the ring of LEDs and more

- **GRBL machines:** a machine can be a GRBL controller on a serial port of the server (port and baud rate, checked as the server checks them), with the note that the server must be built with `--features serial`; the list shows the port and the speed, and the export and import of machines carry them.
- **Free G-code jobs:** Prepare takes a G-code program (pasted or loaded from a file), previews it with its lines, size and time, keeps it ready on a simulator or a GRBL machine and refuses it on a node (and the other jobs on a GRBL machine) before it is sent. The safety switch that starts the spindle and the coolant again when a job goes on is off unless it is ticked.
- **Hold, resume and go on after a stop:** a running G-code job is held and resumed from the list, from its page and from the overview; the job says the line it has got to and what it waits for in words (a tool change, the spindle, a hold, or the wait before the first move of a job that goes on); a job that failed or was stopped offers to go on from its line, with the program kept in the browser.
- **Tools that are off and work already done:** a drilling or routing job takes the tools or pens that are switched off and the holes or paths already done, and the plan says what the server left out.
- **The ring of LEDs and the last quality check** on the page of a machine, for an operator to turn on or off and set, and for everybody to read.
- **The reference of the settings of the server** lists `gcode_finish_wait_s` and `updates_dir`; the refusals `bad_gcode`, `wrong_machine`, `not_pausable`, `not_in_state`, `no_work`, `too_big` and `bad_light` are told in the eight languages; the CSV of the jobs has the line.
- 17 tests more (67 in all).

## [0.0.3] - The spindle of the machine on its page

- **The spindle of the machine on its page:** the page of a machine shows which spindle it carries (the original or the one with a drive), what the server does with a job that asks for more than the spindle gives, the limits of the spindle in use and the top speed to set in the node of the machine; an administrator changes the spindle and the safety switch (`reject` by default, or `warn`). Preparing a job lists, tool by tool, what goes beyond the spindle when the switch is on `warn`, and the refusal `spindle_limit` is told in the eight languages. Texts in the eight languages and 3 tests.

## [0.0.2] - Prepare jobs from Studio, a page for each job and each machine, the drill head node, alerts and a workable job list

- **Prepare a job from Studio:** a page for operators picks the machine and takes the work as the files the programs read (`.NCD` with `.DTD`, `.PLT` with `.RTD`) or as holes typed by hand with the feed, speed and extra stroke of each tool, shows the plan, the time and the travel the server works out, and keeps the job ready.
- **A page for each job:** the plan with the holes already drilled filled in and the next one ringed, the progress, who made it and when, the tools and the buttons that fit its state.
- **The jobs that wait for the operator** are at the top of the overview with a Confirm button, and the overview adds up what the machines have done (jobs, holes, time).
- **A list that can be worked with:** search, five orders, a CSV of what is shown and a button that clears the finished jobs.
- **Alerts:** the title of the tab counts the jobs that wait for the operator; with the preference on, a sound and a notification of the browser say when a new one starts waiting.
- **Machines move between servers:** a copy button and the export and import of machines as a file (the access tokens of the nodes are never exported).
- **One page for each machine:** what it is doing, the jobs that wait for it with their total time and the last ones it finished, with a button to prepare a job for it.
- **Copies and drawings:** a job can be left ready in up to 50 equal copies at once, and the drawing of a plan is saved as an SVG.
- **A lost server is shown:** a red line says when the server stops answering and goes away by itself when it answers again.
- **The node of the drill head on the page of a machine:** its spindle speed, its temperature with the verdict of the node, the protect output, the camera model, its camera and, for an operator, a measure of the table, through EH3D-SERVER.
- **More tests:** 47 (the holes typed by hand, the files, the plan, the list, the CSV, the export and import of machines, the queue of a machine, the copies, the address and the alert).

## [0.0.1] - First release: the pages to set up and watch the machines, with the updates from GitHub

- **Updates:** a page for the administrator compares the installed server and Studio with the latest releases on GitHub, checks on request and updates what is newer, showing what the helper does while it works; it comes back by itself when the server restarts. A workflow builds the archive of the pages that the update takes from the release.
## [0.0.1] - The configuration panel of the EH3D server

- **Three groups of pages:** Monitor (overview, machines by station, jobs, live events), Configure (machines, users and tokens, settings of the server) and Account (my account, preferences, about); each person sees the pages their role allows.
- **Machines:** create, edit and delete the machines of the server with their station, the node they are reached through (address and token, never shown again) and the text of their configuration files, with the checks of the server done first.
- **Jobs:** the list with filters by machine and state, the progress of each job, and start, confirm, stop and delete according to the role and the state of the job.
- **Users and tokens:** create people with a role, change their role, disable or delete them; make a token for each program, shown once.
- **Live:** the events of the server over its websocket, with the reconnection.
- **The look of EH3D-BUNGARD-GUI:** the Forge theme by default (warm black, amber, cards with two cut corners), and Paper, Neon and Midnight.
- **Eight languages:** English, Spanish, Italian, German, French, European Portuguese, Chinese and Japanese, also in the refusals of the server.
- **Served by the server:** `studio_dir` in `server.cfg` makes EH3D-SERVER serve these pages at the root of its address.
- **Tests:** 20 tests of the client of the API, the rules of the forms, the navigation, the fleet and the eight languages.
