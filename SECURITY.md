# Security policy

EH3D Studio is a web page that signs in to EH3D-SERVER and can change what the server holds: machines (with the token of their node), users, tokens and jobs, and from there the machines that move. Treat it as you treat the server.

What it does, and what is tested:

* It keeps one thing in the browser, the login token of the person (and their language, theme and refresh), and sends it only to the server it was loaded from.
* It never shows the token of a node again after it was saved, and shows the token of a program only once, when it is made.
* It offers each role only the pages and buttons the role may use; the server checks the role again on every request, so a hidden button is a convenience, not the protection.
* It checks names, passwords and addresses before sending them; the server checks them again.

What it does **not** do: the server does not terminate TLS yet, so over a plain network the token travels in clear text: use it on the house network or through a VPN, or put a reverse proxy with HTTPS in front. The page has had no independent review.

## Reporting a problem

Please report a vulnerability privately to **electrohobby3d@gmail.com**, with the steps that show it. Do not open a public issue for it.
