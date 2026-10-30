# Contributing to EH3D-STUDIO

Thank you for looking. Studio changes what a server that moves machines holds, so changes are small and tested.

1. **Every behaviour has a test**, including the refusals: a name the server would not accept, a role that may not see a page, a text missing in a language.
2. **Before a pull request:** `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` must pass, and so must `python -I tools/ci_validate.py`.
3. **Texts exist in eight languages** (English, Spanish, Italian, German, French, European Portuguese, Chinese and Japanese): a text is one row of `src/texts.ts` with eight entries, and a test reads every row. The README files keep the same structure.
4. **The server decides.** Studio checks what it can to save a round trip, but never relies on hiding a button: the server checks the role on every request.
5. **No secrets in the page or the repository.** Tokens stay in the browser of the person and the server.
6. Commits are written in English, small and about one thing.
