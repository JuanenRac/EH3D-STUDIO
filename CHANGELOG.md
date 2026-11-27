# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- **Third-party notices:** the release archive carries `THIRD_PARTY_NOTICES` beside the pages, with the copyright notices and licence texts of the packages they are built with (`docs/THIRD_PARTY_NOTICES`, made by `tools/third_party_notices.py`). The CI fails when a package of the dependency tree is not listed.

## [0.2.3] - Answer the new questions of the server when a job resumes, and the spindle and drill settings

- **Before the tool goes down into the work:** when a job that goes on after a stop waits with `pause.plunge`, its page and the monitor says that the head is over the point and that confirming takes the tool down, in the eight languages. Needs the server that asks it; not tried on a machine.
- **Preparing a drilling job asks for the number format of a file that does not declare it:** a list beside the order of the holes sends `drill_format` to the server, with nothing chosen at first and the choice kept in the browser. When the server refuses a file for its format, the page says why and what to choose in the eight languages. The warning of a file read this way says it was read with the chosen format. 2 new tests; checked against a stand-in, not on a machine.

- **The settings of the server have the new `grbl_spindle_stop_on_pause`** (off: a pause of a GRBL machine also stops the spindle and the coolant), with its label and help from the contract of the server. Not tried on a machine.
- **The second question before the spindle or the laser goes on:** a job that goes on after a stop and waits with `pause.power_on` says so on its page and on the monitor, and the form of a machine has the tool for G-code jobs (spindle, laser or not said), in the eight languages. It needs a server with that question.
- **Confirm and Resume answer the question on the screen (safety):** they send back its identifier (`pause.question` of the job), and a server that asks something else by then refuses the answer (`409 question_changed`) instead of taking it as the answer to a question nobody has read. The settings page has the new setting `answer_needs_question` of the server (106 keys). A server of an earlier version is answered as before.

## [0.2.2] - Orders are sent once, buttons rest without a connection and the new stop and resume of the server

- **An order that sets a machine going is sent once (safety):** a double click on Confirm could answer the next question of the machine (the spindle start after a tool change) before anybody had read it. Start, confirm, resume and "go on" are not sent again while on their way and for a second after the server takes them, and the second click of a double click no longer answers "Sure?" nor releases the latch of a machine.
- **Nothing is started or let go from old data:** when the server stops answering, Start, Confirm, Resume and "go on" are off on the page of a job, the list of jobs and the overview, and the page says why. The stop stays at hand.
- **No answer is not told as a plain failure:** an order with no answer says that it may have arrived and the machine may be moving; a stop that did not get there says that it has NOT reached the server.
- **A refused G-code program is explained as the server now judges it** (`422 bad_gcode`: a line that cannot be sent or cannot be judged for certain), with the line and the reason of the server.
- **A plan that comes back late is not shown** for the files or the machine chosen since.

- **Safety text corrected: the spindle is started when a G-code job goes on.** The server now starts the spindle the program had on, after the operator confirms the resume. The switch in Prepare is for the coolant only and its name and warning say so; the wait before the first move of a resumed job says that the machine goes back on its own and starts the spindle, also in the list of the jobs.
- **The reason of a resume the server does not do stays on the page:** when "go on" is refused (`422 bad_request` of `resume-from`), the page of the job keeps the reason of the server and says what to do.
- **The settings page has the five settings of the stop and the resume:** the copy of the contract holds 105 keys (`grbl_stop_wait_s`, `resume_safe_z_mm`, `resume_spindle_wait_s`, `resume_plunge_feed_mm_min` and `resume_position_tolerance_um`, with their texts in the eight languages), and the units millimetres and micrometres are written as `mm` and `µm`.

## [0.2.1] - New secrets for tokens, tokens limited to scopes and warnings of the pick-and-place nodes

- **A token can get a new secret:** each row of the list of the tokens of the programs has a button that asks the server for a new secret (`POST /tokens/{id}/rotate`) after a confirmation that says the present one stops working at once; the name, role, scopes and expiry stay. The new secret is shown this once, and no other one can be asked for until it is put away. A token that has expired offers none. A refusal for the scopes or the expiry says what the request needs, and an answer that never comes says that the secret may have changed unseen. Six new tests, with the ones of the next line. Seen against a stand-in of the server only.
- **A token that expires opens no account:** the page of the users and the tokens says it where a token for a program that creates users is made, warns while such a token is being given days, and the refusal of a user says it too, as the server now answers `403 forbidden_scope` to such a token.
- **A token can be limited to scopes:** the form of the tokens has a switch to limit the token and the scopes that its role can use, with two ready sets for a program that creates users (`admin:users` and every scope of the users it creates: a server now refuses it otherwise with `403 forbidden_scope`). The list of the tokens shows the scopes and the template of each one. A refusal for the scopes while users or tokens are managed says what the request needs, and the text of `forbidden_scope` says it too. The users card says that a new user with the name of a deleted one is another person.
- **Nodes asked too slowly are told:** the Nodes tab shows the warnings of the server (`poll_too_slow`) with the interval, the time after which each node goes to its safe state (and whether it is the one the node says or the default of its contract) and what to change, a badge on the node and that time in its row.
- **The copy of the settings contract and of the error codes follows the server:** `pnp_node_poll_s` is 1 by default and its help says why.
- **A damaged file of machines no longer stops the import half way (fix):** an address that is not a text (a number, a list) made the import end with no message after the machines before it were already added; it is now read as no address and that machine is counted as skipped. One new test.

## [0.2.0] - Printers page with live status, read only

- **3D printers, read only:** a **Printers** tab in the jobs page shows the printers the server watches (`/api/v1/printers`): health, state, temperatures with their targets, progress, time left, layers, job, camera, a box of warnings and a line of news for what is new, with the sound of the alerts when they are on. It has no control at all, and the client only reads (`GET`). What is missing or impossible is shown as unknown, never as zero; an answer that is not the contract is an error. The five new refusals and the five new settings of the server are in the eight languages. Seen against a simulator only.
- **A damaged address no longer stops the page, a link with a name in front of the host is not a link, and numbers typed in hexadecimal are refused:** `parseRoute` raised on an address with a damaged escape (`#/job/%zz`) and left the page blank; a link from the server such as `https://trusted.example@evil.example` was shown as a link of the page; the holes, the tools and the line to start from read `0x10`, `0b11` and `0o7` as numbers; a name cut at sixty units could split a picture in two halves; a time that was not a number showed `Invalid Date`. 45 new tests cover them, the CSV of the jobs, the list of jobs, the plan, the machines moved between servers and the lines of a program.

## [0.1.9] - Eight official languages, PNP nodes panel and job authorization

- **Studio speaks the eight official languages of the ecosystem:** English, Spanish, Italian, German, French, European Portuguese, Chinese and Japanese. The 27 extra languages and the two regional variants (Bulgarian, Croatian, Czech, Danish, Dutch, Estonian, Finnish, Greek, Hungarian, Irish, Latvian, Lithuanian, Maltese, Polish, Romanian, Slovak, Slovenian, Swedish, Norwegian, Icelandic, Ukrainian, Russian, Serbian, Albanian, Catalan, Galician, Basque, Brazilian Portuguese and Canadian French) are gone, with their files, their entries in the selector and the tests that read them. A person whose saved language was one of them, or whose browser asks for one, now gets the language of the browser if it is one of the eight and English otherwise (a test covers it); a region reads its main language. A text a language lacks is taken from English, then Spanish. 7 tests less (611 in all).

- **The settings page has the six new keys and their group:** the copy of the contract holds 95 keys in 16 groups: the group `pnp_nodes` with `pnp_nodes_enabled`, `pnp_nodes_max`, `pnp_node_poll_s`, `pnp_node_silence_s` and `pnp_node_timeout_s`, and `work_require_authorization`. All six are set in `server.cfg`, so Studio shows each one with its control, its text in eight languages and the place where it is set; the hash of the copy follows the new file.

- **A Nodes tab for the pick-and-place machines:** the jobs page lists the feeder and head nodes that the server keeps (`GET /api/v1/pnp/nodes`) with their kind, machine and address, their health, whether they are ready, the last error of their poll, the counts of the feeders and the nozzles they said last and the number of good and failed polls, and a SIMULATOR ONLY badge. The list updates itself when the websocket of the server sends `pnp_node` (the nodes are not polled from here), mends the connection with a new ticket and a wait that grows to 30 seconds, and says in the words of the server when the nodes are switched off (`pnp_nodes_off`).

- **Who may do what with the nodes:** a viewer only reads, an operator can ask a node now (`POST /pnp/nodes/{id}/poll`, not offered for a node that is switched off), and an administrator registers, changes and removes nodes with a second touch for each action. The form is checked before anything is sent (id, name, `host:port`, a token with no spaces), the token field of a node that has one is left empty to keep it (the mark `********` is sent) and the token is never shown.

- **The hash and the authorization of a job:** the queue shows the `toolpath_sha256` of each queued job and whether it is authorized, not authorized or authorized for a hash it no longer has (out of date); a person with the scope `jobs:authorize` authorizes it with a second touch, and the start sends the same hash, so the server refuses with `stale_authorization` a job that is no longer the one that was shown. After `stale_authorization` or `authorization_required` the job opens with its present hash. `pnp_node_not_ready` is told with the words of the server.

- **Twelve refusals are told in the eight languages:** `pnp_nodes_off`, `unknown_pnp_node`, `bad_pnp_node`, `pnp_node_exists`, `pnp_nodes_full`, `pnp_node_disabled`, `pnp_node_not_ready`, `stale_authorization` and `authorization_required`, and the codes `bad_bgcode`, `bambu_lan_off` and `bgcode_unsupported` that had no text; the copy of the catalog of the server is again the whole catalog (163 codes). The new texts are written in the first eight languages and in the Cyrillic and Greek ones; the other languages use the English text for the new rows until they are translated.

- **32 more tests (611 in all):** the client and the rules of the nodes (health, readiness, who may do what, the form and its body, the token that is never kept), the websocket event with random messages from a fixed seed, the connection that mends itself, the tab drawn in a small page against a simulated server that keeps the nodes (a viewer, an operator and an administrator, the second touch, the token that is never shown, the server that has the nodes off and the address that is refused) and the authorization of a job from the first touch to the refusal of a stale hash.

- **The settings page works for every login, not only for an administrator:** a login that is not an administrator no longer sees only the copy kept in Studio with no values. The page reads the light, read-only view of the values in force (`GET /api/v1/settings/values`, open to any login, a few kilobytes) and draws them with the texts of the copy of the contract that Studio keeps. An administrator still reads the full contract; one whose token cannot read it (it lacks the scope of the policy) falls back to the light view without a complaint. Nothing can be changed from the light view.

- **ETag and 304:** the page sends the tag of the last light answer in `If-None-Match`, keeps what it shows when the server answers `304`, forgets the answer when the login changes or a read fails, and asks again by itself every 30 seconds while it shows the light view. An answer longer than 16 KiB, a document of another or a newer schema, a malformed one or a server that does not answer ends as the copy kept in Studio, read-only, with the reason.

- **A secret or a path of the computer is never shown:** a key the server marks secret (or whose value is the mark `***`) shows no value, whatever the server sent in its place; a key whose value the server keeps back says so; a value the server cut ends with an ellipsis; a key neither contract describes is drawn read-only, and the keys `__proto__`, `constructor` and `prototype` are refused so that an answer cannot touch the prototype.

- **The page says when its copy of the contract is out of date:** the hash of the copy (`src/services/contracthash.ts`, the SHA-256 of the file with LF line ends, written and checked by `tools/sync_settings_contract.py`, also without the server next to it) is compared with the `contract_hash` of the server, in the full contract and in the light view, and a warning is shown when they differ. The copy of the contract is refreshed from the server (it now carries the description of the light view), and the three new texts are in all 37 languages.

- **The simulated server speaks the light view:** `GET /settings/values` with its `ETag`, `If-None-Match` and `304`, a role for the login, the full contract refused to anyone but an administrator with the scope of the policy, and the hash of the contract it claims, so the whole flow is tried with no server and no machine.

- **28 more tests:** the hash of the copy against the file, the parser of the light answer with hostile documents, who reads what, the ETag and the 304 against the simulated server, a seeded storm of roles, failures and changes, and the page for an operator, a viewer, an administrator without the scope and a server that fails.

## [0.1.8] - Settings panel drawn from the contract of the server, a new login after a change of policy and the pages package of the update helper

- **55 more tests:** the copy of the contract against the file of the server, every key with a control and a text in the eight languages of the contract, the groups, the text by language, the control by type, who may write, the range, the restore of the default, the restart, the secret, the refusals by their code, the live contract against the copy, and a key nobody described.

- **The page of the server draws every setting and switch from the contract of the server:** the groups (network, storage, logins, audit, updates, machines, compatibility, slicer, printers, tasks, artifacts, projects, catalogs, events and design), and for each key its label, help and warning in the language of the person, the value in force, the default, and whether a change applies at once or needs a restart. Studio reads `GET /api/v1/settings/contract` and no longer keeps a list of its own, so a setting the server adds appears without a new version of Studio.

- **Every switch and setting the server lets change can be changed from Studio:** an administrator changes the keys of the policy with the control of their type (a switch, a number with its range and unit, a text, a list or a choice), each written by the route and method the contract names (`PUT /api/v1/auth/policy`), with a button to restore the default and the sentence of the server for each refusal.

- **A change is checked and asked before it goes out:** a number outside its range or a text that is too long is refused on the screen before anything is sent; a change that touches the security, the exposure, a machine or the data shows its warning and waits for a confirmation; a value looser than recommended is asked again when the server asks for `confirm_weak`.

- **What needs a restart says so:** each key shows whether it applies at once or when the server restarts, and after saving one of the second kind the page says that it takes effect when the server restarts.

- **The keys set in `server.cfg` are shown, not hidden:** they show their value and where they are set, with no control, and a secret never shows its value and is never written.

- **The page still works when the live contract cannot be read:** a role without the scope, a server without the route or an answer Studio does not understand show the copy that Studio keeps, read-only, with the reason and no value in force; a person who is not an administrator sees the page read-only.

- **A key nobody described does not break the page:** a value the server reports that neither contract lists, and a setting of a type Studio does not know, are shown with a generic read-only line, and a setting that the server describes and the copy of Studio does not is marked as newer than the copy.

- **The table of switches of the security page and the new page do not repeat each other:** the explanations of `persist_sessions` and of the switches that are off by default are shown in both from the same texts, and the security page links to all the settings of the server. The simulated server answers the contract too.

- **19 new texts in the 37 languages** for the page of the settings (the title and the buttons reuse the existing ones).

- **A copy of the contract with a check:** `tools/sync_settings_contract.py --check` fails in the CI when the copy at `src/data/settings-contract.json` is not the file of the server (next to this repository) or is not a contract of the version Studio understands (alone, it checks the schema); `--write` refreshes it from the server.

- **Signing in again without leaving the page of the updates:** when the server restarts in the middle of an update and the login ends with it, the page shows a box with the name and the password right where the update is, with the same sign-in as the first screen. Once you are in, the page goes on following the job where it was (the steps, the bars, the log and the earlier jobs come from the server) with no reload and no loss of what was shown. The button that did nothing useful is gone.

- **The last known state stays on the page and says so:** while the sign-in is asked for, the steps, the bars and the log of the update stay as the last answer of the server, marked as the last known state, and the page keeps following the update afterwards (a Studio that was replaced still reloads once).

- **A clear sentence when the login ends with the restart:** the page no longer says two things at once (the server is restarting and the name or password is wrong); it says that the login ended when the server restarted and asks to sign in again to keep watching the update, in the 37 languages. The password is only in the form while the request goes: it is emptied as soon as the answer comes and is never written to any store of the browser; a wrong password is said inside the box and does not take you out of the page.

- **The switch that keeps the logins when the server restarts is explained in the security table:** `persist_sessions` shows a text of its own in the 37 languages (keep the sessions when the server restarts, with the advice to turn it on before updating so that nobody has to sign in again), and it can be changed there when the server lists it as editable; it is shown only when the server brings it.

- **9 more tests:** the phases of an update after a sign-in again, the rules of the box, the last known answer, the box against a server that restarted (sentence, last known steps, sign-in and continuation, wrong password, empty password, the password in no store) and the text and the editing of the switch.

## [0.1.7] - Safety of the machines of the plugins, simulator badge, emergency stop and release by role and 36 more refusal codes in every language

- **36 more refusals of the server have a sentence in the eight languages and in the other 29:** the codes of the laser (`laser_estop_latched`, `laser_power_limit`, `laser_feed_limit`, `air_assist_off`, `enclosure_open`, `focus_not_checked`, `test_fire_refused`), of the pick-and-place machine, the board work (`bad_gerber`, `missing_layer`, `unit_unknown`), the router (`machine_alarm`, `jog_while_running`, `out_of_travel`), the 3D printer (`printer_latched`, `thermal_runaway`, `temperature_over_limit`, `program_over_limit`, `farm_no_free_printer`), the slicer and the compatibility routes were shown as `code: detail`; each now has its own sentence, written in its own words in every language, and the test against the catalog of the server covers all 151 codes.

- **A machine that has only run against a simulator says so:** the machines of the plugins `laser`, `pnp`, `pcb`, `cnc`, `gerber`, `cam`, `printer3d`, `vision` and `cad` carry a *simulator only* badge on the Machines tab (and their plugin in the list of plugins), read from the `detail` and the capabilities that the server sends, so none is shown as proven on hardware.

- **The interlocks of a machine are shown in red:** a latch, the latch of an emergency stop and an alarm (also the `Alarm` state word of a router) are badges next to the state of the machine, a queue that starts its jobs by itself is called out, and the other facts the plugin sends (power, mode, position flags) are listed under the name.

- **The emergency stop is one touch for an operator:** the button stops a router or a 3D printer by the route of its plugin (heaters off, motors released, machine latched) and any other machine by cancelling its job, never asks "Sure?", is not offered to a viewer or to a machine that is already held, and is sent once more when the server did not answer the first time.

- **Only an administrator releases a latch, and asks twice:** a machine held by an emergency stop, a fault or an alarm gets a release button for an administrator (the laser by its own route), with the second touch that the other dangerous buttons have; an operator sees the latch and no way to undo it.

- **A person starts the print of a 3D printer:** a print that waits in the queue says so, starting it asks twice like every start, and Studio never switches a queue to start by itself.

- **The four switches of the server that are off are explained on the Security page:** `mdns_announce`, `compat_api`, `compat_write` and `slice_enabled` show what they do and that they are off by default, and turning one on is asked again (`confirm_weak`) before it is applied.

- **The simulated server knows the machines of the plugins and the switches of security, and the contract is tested:** it holds a laser, a router and a latched printer and answers the emergency stop, the releases and the policy as the server does; new tests run the client against it and, next to the repository of the server, against its routes, its switches and its codes.

- **38 more tests:** the rules of the safe actions by role and scope, the interlocks and the facts of a machine, the routes of the stop and the release, the pages of the machines and the security with each role, a stop that does not arrive, and the contract with the server.

## [0.1.6] - Safer CSV of jobs and numbers that are not finite

- **Every refusal of the server has a text in the eight languages:** 29 codes of the catalog of the server (machine and project store, catalogs, the inspection of the drill head, the tool rack, unsafe file names) were shown as the bare code; they now have their own sentence, and a test compares the catalog of the server with the texts when the server repository is next to this one.

- **A stop that the ended login refused is sent again after the next login:** when the stop of a machine is answered with an ended session, the order is kept in memory only for two minutes and is sent once more as soon as the person logs in again, as the phone apps already do; an order older than that, or refused for another reason, is dropped so that it never stops a later job.
- **The stop button gives up waiting sooner and tries once more:** the call of the stop waits 3 seconds instead of the 15 of an ordinary request and, when it gets no answer or does not reach the server, it is sent once more (the stop is harmless with no job to end). A stop the server answered, even with an error, is not repeated. Tested with a first attempt that hangs, two that hang and an answered error.

- **The warning that the unit of a drill file was supposed is shown in the summary of a job:** when the server says a drilling file does not state its unit (`units_supposed`), the summary shows the text in the language of the program (37 languages; the two variants inherit). Tested with the key, the absence of numbers to fill in and every language of the core.
- **The CSV of the jobs no longer runs a name as a formula:** a name or a message that starts with `=`, `+`, `-`, `@`, a tab or a return is written with a quote in front, so that a spreadsheet shows it as text; numbers (even a negative one) and every other text are written as before. The test that waited for this fix is switched on, with tests for each starting character.
- **A bound or a tool that is not a finite number no longer spoils the plan:** a plan whose bounds hold a number that is not finite is drawn in the box of an empty plan (it was a box of `NaN` that drew nothing), and a tool number that is not finite takes the first colour instead of an undefined one; a fraction takes the colour of its whole part.
- **A work already done that is not a finite number is not sent:** `withSkips` and `gcodeRequest` leave `skip` out for `NaN` and infinity (the infinity was sent as `null` in the JSON of the request); a positive number is cut to a whole number as before. Tested with each kind of number.

## [0.1.5] - The pages archive is attached to the release again, a simulated server for the client and more tests

- **The release file is attached again:** version 0.1.4 was published without `eh3d-studio-0.1.4.tar.gz` (and its `.sha256`), so the update of Studio from the server said that the release had no such file. This version is built and attached from its own commit by the release workflow, with the names the update helper of EH3D-SERVER looks for (`eh3d-studio-<version>.tar.gz` and its `.sha256`).

- **A simulated server for the client (`src/simserver.ts`):** a transport that answers like EH3D-SERVER from the examples of its answers and fails on purpose when told to: the server down, a refusal (503), a page that is not JSON, a server that accepts the request and says nothing, a login that expired and a link that fails by chance from a seed. Nine new tests (441 in all) check that each failure reaches the page as its error, that a request that hangs ends as a timeout and the polling does not pile requests up, that a new login recovers an expired session and that the same seed fails the same requests. It has only run against this simulation: no real server or machine was used.

- **33 more tests of the shell of the application and a floor of coverage:** the watch of the jobs that wait for the operator (the title, the bell, the notification, the clock of the looks), the check that the server answers, the copy to the clipboard and the places the login token is kept are tested with a clock that the test moves by hand; the CI stops when the tests cover less code than today (the `thresholds` of the coverage in `vite.config.ts`).

- **69 more tests and a measure of the coverage:** the parts every page is built from (cards, fields, progress bars, the buttons that ask once more), the drawing of a job, the summary before a job starts and the button that starts it, the sign-in screen (with the set-up of the first administrator), the preview of a file of a project with its versions, and the small helpers of the pages are tested in a small DOM; `npm run test:coverage` measures how much of the code the tests run and the CI runs it.

## [0.1.4] - Security page for kept logins and an update page that no longer sticks

- **The shared validation tools are updated:** the validator also runs the workflow and lessons checks of the suite with their latest rules, including a check to run before every push.
- **The CI validation checks the workflows and the lessons of past CI failures against a baseline:** `tools/workflow_hygiene.py` and `tools/lessons_lint.py` (copies of the shared tools) run in the validation, and only findings that are not in `tools/workflow_hygiene_baseline.json` and `tools/lessons_lint_baseline.json` fail it, so what exists today stays as it is and a new one is caught. `python tools/workflow_hygiene.py --root . --detail` and `python tools/lessons_lint.py --repo .` list the findings.
- **The security page describes the switch that keeps the logins through the restart of an update of the server:** `update_keep_logins` (off by default, edited like the other switches with the confirmation of a looser value) is listed in the settings of the server with its text in the 37 languages, so the page of the updates can follow an update of the server to its end without the person signing in again.
- **The page of the updates no longer stays on "Updating" when the server restarts under it:** the server restarts in the middle of its own update and, unless `persist_sessions` is on, the login ends with it, so every later request was refused and the page kept the last answer for ever (pressing F5 showed the update done). The page now tells the phases apart (asked, updating, restarting, done, failed), says that the login ended when the restarted server refuses it and offers **Sign in**, says that the server did not answer when it stays away for three minutes (and gives the buttons back with **Reload Studio**), and loads itself again, once, when the update it was following replaced the pages of Studio. Tests: the phases, a server that refuses the login, one that answers 503 and comes back, and one that never comes back.
- **The validation of the CI is the reusable one of the documentation hub:** the job `validate` calls `validate.yml` of EH3D-DOCS (pinned by commit) and the check of the CHANGELOG is a job of its own.
- **A pull request must say what it changes:** the validation runs `tools/changelog_pr_check.py` on a pull request (it fails when the CHANGELOG has no new line under [Unreleased]; the label `no-changelog` skips it), the same check as the other repositories of the suite.
- **The CI keeps its actions up to date and does not pile up runs:** a `dependabot.yml` groups the updates of the GitHub Actions in one monthly request, a new push to a branch cancels the run of the older one that is still going, and the Rust jobs have a time limit, so a stuck job cannot hold a runner for hours.

## [0.1.3] - Login token kept by the tab, switches of the server on the security page, a catalog of refusals and Portuguese of Portugal

- **Portuguese of Portugal without "você":** the label "you" of the sessions is now "tu", and a test reads the whole Portuguese column of the texts for the forms of Brazil.
- **The security page shows the new switches of the server:** `network_open` (open the server to the network; the server now listens on this computer only by default, so the table of the settings shows `127.0.0.1:18200`) and `update_allow_unsigned` (let the update helper install a release without a signature; a signature is required by default) can be turned over with the confirmation of a looser value, and the table says next to `network_open` that it takes effect when the server restarts (`restart_required` of the policy). Their descriptions are in the 37 languages.
- **The login token is kept by the tab, and by the browser only if the person asks:** the token now lives in `sessionStorage`, so closing the tab or the browser ends the login and another tab does not see it; the sign-in has a box **Remember me on this computer** (off by default, with a warning not to tick it on a shared computer) that keeps it in `localStorage` instead. The token is in one store only, signing out (or a refusal because the login ended) removes it from both, a token an earlier version left in `localStorage` is still read, and a browser that keeps nothing is not an error (`src/tokenstore.ts`, with its tests). The text of the box is in the 37 languages.
- **The release links of the page Updates are web addresses only:** the link to a release is shown only when the address the server gives is `https://` or `http://`, so an address such as `javascript:` or `data:` is never turned into a link; one more test (314).
- **Signing out leaves no G-code in the browser:** the programs kept for a job that may go on are removed from the browser when the person signs out (or the session expires), and only the newest eight are kept while working, so the store no longer fills with the programs of old jobs; two more tests (313).

## [0.1.2] - Design runs from the pages, the audit, the keys and the security policy, the quotas and the single sign-in

- **Running the checks on the server:** the four buttons of the page Design and factory ask the server to run the design program on a board file of a project of the `pcb` application (`POST /api/v1/apps/pcb/jobs`), wait for the job and read the project again; the report a run keeps (an envelope with the JSON of the program) is shown like any other report. A server that is not set up for it answers `501 design_run_unavailable` and the page says so. A viewer sees the buttons off.
- **The audit, the keys and the TLS fingerprint in the page Security:** the audit with its filters by person and event, the tokens of the programs by identifier and age, and the fingerprint of the certificate the server names, in place of the card that said they were not available.
- **Switches of security that can be changed while the server runs:** the switches the server lists as `editable` have a button or a number to type; a value the server says is looser than recommended is asked a second time before it is applied.
- **The limit next to the use:** the detail of a project shows the space and the files used next to the limits of the store of the application.
- **Sign-in with the single login:** Studio signs in with `POST /api/v1/auth/login` and `app: "studio"`.
- **Texts:** 13 new texts and 2 changed ones in the 37 languages, and the sentences of four new refusals (`design_run_unavailable`, `bad_design_request`, `bad_policy`, `weak_confirm_required`); 8 new tests (311 in all).
- **The document of what the server gives** (`docs/DESIGN_FACTORY_CONTRACT_NEEDS.md`) marks what is now covered and what is still missing.

- **The workflow that builds the pages no longer lists its own sums file in the sums:** the check of the hashes after the build failed because of it.

## [0.1.1] - New pages over the services of the server: projects and files, machines and jobs, security, and design and factory

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
