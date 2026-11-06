# Projects and files

The page **Projects** (group Services) is the explorer of the project store of EH3D-SERVER (`/api/v1/apps/{app}/projects`, `docs/PROJECT_STORE.md` of that repository). The code is `src/pages/ProjectsPage.tsx`, `src/components/FilePreview.tsx` and, without any page in it, `src/services/store.ts` (client and rules), `src/services/explorer.ts` (the reducer) and `src/services/http.ts` (the transport).

## What it does

* Lists the projects of an application (`studio` by default; the list of applications comes from `/auth/apps`), with search over the name, the id and the owner, tags written in the name as `#word`, "mine only" and three orders. The tags and the search work on the list, in the client.
* Shows the tree of the files with the version, size, SHA-256 and author of each, the space used by the project, and a preview of a text (also drilling, G-code and Gerber files, cut at a number of lines and characters), of JSON (indented) and of an image. A file that is too big, or neither text nor image, is downloaded instead.
* Lists the versions of a file with their SHA-256, shows or downloads any of them.
* Uploads a file as a new version, imports an `.eh3dproj` container (into the project or as a new one), exports the project as a container.
* Takes, renews and releases the editing lock, with the time left counting down and marked when it is about to end; an administrator takes it away from somebody else.
* Renames, hides (the owner or an administrator) and purges (an administrator, a hidden project).

## The tag (`If-Match`)

A write over a file that exists carries the SHA-256 of the version in the list the person saw. If somebody wrote in between, the server answers `412`; a missing tag is `428`; somebody else's lock is `423`. The page shows these three as a warning with a way out: reload, or write over it anyway (a second confirmation that reads the list again and uses the fresh tag). Other refusals (file too big, no room left, a name that is not valid) are told with their sentence.

## Roles

A viewer reads, previews and downloads; an operator also writes, locks, imports and hides their own projects; an administrator also purges and takes locks away. The page hides what the role does not allow and the scopes of a token narrow it (`src/services/permissions.ts`); the server decides in the end.

## Limits of the client

Downloads and uploads are bounded (32 MB by default, 128 MB for an export, 2 MB for a preview), every request has a time limit, and only reads are tried again (twice, with a longer wait). The quota limits are the server's (`project_max_mb` and others): Studio shows the space used and the refusal `507`, not the limit, because no route tells it.

## What has been tried

Against a stand-in of the server in the tests. Not against EH3D-SERVER running, and not on the CM5.
