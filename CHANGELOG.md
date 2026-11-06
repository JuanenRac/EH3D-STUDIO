# Changelog

All notable changes to this project are documented here.

## [Unreleased]
- **Projects and files:** a page that explores the project store of the server: projects by application with search and tags, the tree of the files with their versions and SHA-256, a preview of texts (drilling, G-code, Gerber), JSON and images, upload, download, import and export of `.eh3dproj`, the editing lock with its time left, and the conflicts of `If-Match` (412, 428, 423) told as a warning with a way out.
- **Machines and jobs of the plugins:** the queue and history of the generic jobs with progress and confirmations, the plugins and machines, the live events (server-sent events with a ticket, `Last-Event-ID` and a reconnection that waits longer each time), notifications, and the table of the places of the tools in the changer with the checks of BUNGARD-GUI.
- **Security:** the session and the open sessions (listed and closed), what each role may do, and the policy of the server with the switches that deserve a look; the audit, the keys and the fingerprint of the TLS are marked as not available on this server.
- **Design and factory:** the reports of check, connectivity, bill of materials, assembly bill, fabrication package and panel found in a project, as tables with the severity in words and marks; running the checks waits for the server (`docs/DESIGN_FACTORY_CONTRACT_NEEDS.md`).
- **Four groups in the menu, loaded when first opened:** the new pages are in the group Services and in Account, load lazily, and follow the role and the scopes of the token; 168 new texts in the 37 languages and ten new refusals; 130 new tests (303 in all).
- **37 languages:** the interface speaks the first eight (English, Spanish, Italian, German, French, European Portuguese, Chinese, Japanese) and 29 more: Bulgarian, Croatian, Czech, Danish, Dutch, Estonian, Finnish, Greek, Hungarian, Irish, Latvian, Lithuanian, Maltese, Polish, Romanian, Slovak, Slovenian, Swedish, Norwegian, Icelandic, Ukrainian, Russian, Serbian (Cyrillic), Albanian, Catalan, Galician, Basque, Brazilian Portuguese and Canadian French, with the same list, order and names as the other apps of the family. The first eight stay as rows of `src/texts.ts`; each new language is a JSON file in `src/locales/` (the two variants only hold what differs from Portuguese and French). The language is chosen from the one saved, then the browser (Brazil gives `pt-br`, Canada `fr-ca`, `nb` and `nn` give `no`, any other region its main language), then English; a text a language lacks falls back to the main language of a variant, then English, then Spanish. The selector shows the 37 names in their own language and scrolls. None of the 37 is written from right to left, so no right-to-left layout is needed. The 29 new languages are translations by the model that wait for a review by native speakers. 8 tests more (173 in all): every language has every text, none empty, the same `{markers}` and `code` words as English, the variants only with keys of the source, Cyrillic and Greek where they belong, and the choice of language.
- **The sentences of the new refusals:** the catalog of the error codes of the server is copied again (27 new codes for the artifacts, the projects, the sharing, the uploads and the computing tasks) and each one has its sentence in the eight languages; the README says the real count of tests.
- **Brand:** Add the application icon and the logos of the program.
- **Release builds are checked and attested:** `release-dist.yml` takes the owner's go-ahead only (a manual start from main, the commit must be part of main), builds the same packages as before, writes `SHA256SUMS` and a build manifest, attests their provenance, verifies the artifact as a stranger would, prepares a draft release of unsigned files only after the owner approves it (a dry run is the default) and opens an issue `build-failed` when anything does not finish.
- **Shared checks updated:** the validator also compares the badge and the Version row of the README with the manifest, fails when one of its checks cannot run, and the CHANGELOG step of the workflow reads the base branch from the environment.
- **The workflows are hardened:** every action is pinned by its commit with its version in a comment, the checkouts keep no credentials, and the release workflow runs only for the owner on main, with no cache and the values of the matrix passed by environment.
- **More tests:** the title and the alert, the page that asks again, the copy to the clipboard, the languages and the texts in each of them, and the sentences of the errors.
- **The page of the updates says what the helper does with the file of signers:** a release is installed only with a valid signature when the file is there.

## [0.1.0] - Time limits, token list, catalog check and who handled a job

- **Every request has a time limit:** a request that gets no answer is cancelled and ends as the error `timeout` with a sentence in the eight languages (5 s for the health check, 15 s for the rest, 60 s for the planning of a job: its preview, creating and starting it); a server that accepts the connection and then says nothing no longer leaves the page waiting, and the indicator that says the server does not answer turns on. 4 tests.
- **A page that asks again every few seconds waits for the last request:** `usePolled` starts no new request while the previous one is in flight, so a slow server does not collect a pile of them. 2 tests.
- **The refusals of the server are checked against its catalog:** a test reads the list of codes that the server copies here and demands a sentence in the eight languages for every one, except an explicit list of codes shown with the words of the server. Ten refusals gained a sentence: `bad_days`, `internal`, `local_only`, `no_inspection`, `not_running`, `out_of_table`, `storage`, `unknown_token`, `update_refused` and `updates_off`. 4 tests.
- **Tokens of programs with an expiry and a last use:** the list says when each was last used and when it expires, marks in amber the ones not used for more than 90 days and says when one has expired; the form takes the days it lasts (empty: the server decides). 3 tests.
- **A job says who started it and who stopped it** in its detail.
- **The server page shows the switches in force** (`trust_forwarded_for`, `exit_on_panic`, `persist_sessions`, `url_token`, `local_until_setup`) as the running server reports them, and lists the new settings with their defaults. 2 tests.
- **The live page says when it missed events:** the line `resync` tells that the server found the page behind. 1 test.
- **The maturity is functional:** the manifest, the badge and the table of the eight README files say it, since it is used and tried with real files; the evidence stays as host tests.
- **The notes of a release keep the names written between quotes as they are:** `api_revision` and `tests/examples/*.json` no longer lose their underscores and stars on the Updates page; only the markers of the bold and the quotes themselves go. With a test.
## [0.0.9] - Summary before starting, undo of an update and examples of the server

- **The answers of the server are read in the tests from its own examples:** the fleet, the jobs, a job, the preview, the spindle, an error and the updates are the files that the tests of the server make, so a change in the answers that the Studio does not follow fails here.
- **Put back the earlier version:** a service that an update left a version behind for shows a button to put that version back (it asks first, and the page says which version it is when the helper knows it); the job shows its step and the history says it was a put back. Needs the matching server.
- **Clear the history of the updates:** a button in the card of the earlier jobs empties the list (it asks first).
- **A summary before a job starts:** the Start button of a job (on its page, in the monitor and in the page of a machine) opens a window with what the job does, how long it takes, how far each axis goes (the dry run of the exact plan that the server measures), and what looks wrong in the file (a unit that is probably wrong, a work bigger than the table, a scale that is not 1, an axis that would go past its course); Start in the window starts it. A preference of the browser turns the window off (on by default) and the button then asks "Sure?" as before. The refusal `outside_course` of the server is told in the eight languages. 5 tests.
- The preview of the Prepare page shows the same dry run and warnings.

## [0.0.8] - An update page that shows its steps, the version of the package that was left behind and what changes in each release

- **The version that was installed is the version that is shown:** the package of 0.0.7 was built with the number of 0.0.6 inside (`package.json` was left behind), so after an update the page still said 0.0.6 and the server took the update for not done. A test now fails when `package.json`, `package-lock.json` and the manifest do not agree.
- **An update page that shows what is happening:** the service that is updated shows its steps (download, check the file, install and, where there is one, restart) with a bar each, a bar for the whole job, the state, the log with a button to copy it, and the earlier jobs below. While the server restarts the page says so and goes on by itself.
- **What changes in each release:** a button beside each service opens the notes of the latest release, read from its changelog, as text.
- **An update button for each service** (and a reinstall for the one that is current), besides the one that updates everything that is newer.
- **Reload after the pages are replaced:** when Studio itself was updated the page offers a button to load it again, and says why.
- **Texts:** eighteen new texts in the eight languages; tests for the notes, the steps and the reload.

## [0.0.7] - A stop that reaches the machine at once, refusals in the eight languages and a last quality check

- **Start asks once more:** the Start button of the job page, of the Monitor list and of the queue of a machine needs a second touch (the first one asks "Sure?"); a touch by mistake no longer sets the machine going.
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
