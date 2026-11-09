# Security policy

## Supported versions
Security fixes are made for the latest release.

## Reporting a vulnerability
Please **do not open a public issue** for security problems.
Use GitHub's **[Report a vulnerability](https://github.com/tahtk3v/kevcast/security/advisories/new)**
(Security tab → Advisories), or email **hai@bnuy.nl**.

Please include:
- the affected version
- a description and steps to reproduce
- the impact (what an attacker could do)

You'll get a reply within a week. Please give us reasonable time to fix the issue before disclosing it.

## Dependency updates
[`.github/dependabot.yml`](.github/dependabot.yml) configures Dependabot for the server (`/`), the desktop apps
(`/desktop`) and the GitHub Actions workflow. To turn it on, open **Settings → Code security** on GitHub and enable:
- **Dependabot alerts**: you get a warning when a dependency has a known vulnerability.
- **Dependabot security updates**: a pull request with the fixed version is opened automatically when an advisory is published.
- **Dependabot version updates**: weekly pull requests for npm (minor and patch updates grouped) and monthly ones for GitHub Actions. This uses the yml file and is active once it's on the default branch.

Every Dependabot pull request runs the *Build* workflow (tests plus all installers), so a green check means the update builds on Windows, macOS and Linux.
After merging a security update, publish new installers so screens and servers get the fix.

## Hardening tips for operators
- Put KevCast on an internal network or behind HTTPS (see [docs/installation.md](docs/installation.md#https-and-a-friendly-address-optional)).
- Use a strong admin password, and keep `data/secret.key` and the provisioning key private.
- Rotate the provisioning key (**Settings → New key**) after a roll-out, or if it leaked.
- Remove displays you no longer use. This revokes their access at once.
- Run screen PCs under a restricted user account. KevCast Player only closes with its exit shortcut.
