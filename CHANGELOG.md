# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- **Prepare a job from Studio:** a page for operators picks the machine and takes the work as the files the programs read (`.NCD` with `.DTD`, `.PLT` with `.RTD`) or as holes typed by hand with the feed, speed and extra stroke of each tool, shows the plan, the time and the travel the server works out, and keeps the job ready.
- **A page for each job:** the plan with the holes already drilled filled in and the next one ringed, the progress, who made it and when, the tools and the buttons that fit its state.
- **The jobs that wait for the operator** are at the top of the overview with a Confirm button, and the overview adds up what the machines have done (jobs, holes, time).
- **A list that can be worked with:** search, five orders, a CSV of what is shown and a button that clears the finished jobs.
- **Alerts:** the title of the tab counts the jobs that wait for the operator; with the preference on, a sound and a notification of the browser say when a new one starts waiting.
- **Machines move between servers:** a copy button and the export and import of machines as a file (the access tokens of the nodes are never exported).
- **One page for each machine:** what it is doing, the jobs that wait for it with their total time and the last ones it finished, with a button to prepare a job for it.
- **Copies and drawings:** a job can be left ready in up to 50 equal copies at once, and the drawing of a plan is saved as an SVG.
- **A lost server is shown:** a red line says when the server stops answering and goes away by itself when it answers again.
- **More tests:** 46 (the holes typed by hand, the files, the plan, the list, the CSV, the export and import of machines, the queue of a machine, the copies, the address and the alert).

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
