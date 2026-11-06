# Design and factory

The page **Design and factory** (group Services) shows the reports that the design tools (EH3D-PHOENIX-PCB) left as JSON files in a project of the store (applications `pcb`, `cam`, `laser`, `pnp`, `cad`). Code: `src/pages/FactoryPage.tsx` and `src/services/design.ts`.

A JSON file is a report if it has the shape of the output of `phoenix check` / `connectivity` (rule findings, confirmed and inconclusive), `bom` (the bill, with offers and totals), the assembly bill, the manifest of `fabpack` or the summary of `panel`. The page reads at most twelve small JSON files of the project and shows each as tables. Severity is said in words and in a mark as well as in a colour; a finding can be followed by its object, and its position (in millimetres) copied.

Running the checks on the server is **not available**: the four buttons are there and off. What the server would need is in `DESIGN_FACTORY_CONTRACT_NEEDS.md`.
