# Development

## Prerequisites
- Node.js 20+ (the server also runs on 18)
- LibreOffice and Poppler, to test PowerPoint conversion
- For the desktop apps: the OS you build installers for (Windows for `.exe/.msi`, macOS for `.dmg`)

## Server

```bash
npm install
npm run dev                  # node --watch, restarts on changes
# http://localhost:8080/admin/   http://localhost:8080/player/
KEVCAST_DATA=/tmp/kc-dev PORT=8090 npm run dev   # separate data folder/port
npm test                     # schedule logic + API flow (node:test)
```

The admin and player are plain JavaScript with no build step. Edit a file in `public/` and refresh the browser.

## Desktop apps

```bash
cd desktop
npm install
npm run player -- --server=http://localhost:8080   # run the player from source
npm run studio                                     # run Studio from source
```

On Linux as root (e.g. in containers) add `--no-sandbox`. While developing, use **Ctrl+Shift+W** in the player
for windowed mode, or set `"windowed": true` in your user `config.json`.
Autostart is only enabled in packaged builds.

### Building the desktop apps

```bash
cd desktop
npm run dist:player     # → desktop/dist/player/
npm run dist:studio     # → desktop/dist/studio/
```

Each build produces installers for the OS it runs on. The `.github/workflows/build.yml` workflow builds
Windows, macOS and Linux (x64 + arm64) on every push to `main` and on tags `v*`. Download the results from the
workflow run's **Artifacts**.

**Code signing**: builds are unsigned by default. For production:
- Windows: set `CSC_LINK` / `CSC_KEY_PASSWORD` (a code-signing certificate) as repository secrets.
- macOS: also set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for notarisation.
- Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` in the workflow.

See the electron-builder documentation for details.

## Project layout

See [Architecture](architecture.md#components).

## Conventions
- Keep the server dependency-light: no native modules, so installs never need compilers.
- Every user-facing string should make sense to a receptionist, not only to IT.
- New schedule logic goes in `shared/schedule.js`, with a test in `test/schedule.test.js`.
- API changes: update [docs/api.md](api.md) and add to `test/api.test.js`.

## Dependency updates
Dependabot ([`.github/dependabot.yml`](../.github/dependabot.yml)) opens pull requests for npm packages (server and desktop)
and GitHub Actions. Security fixes arrive as soon as an advisory is published. Enable it under
**Settings → Code security** (see [SECURITY.md](../SECURITY.md#dependency-updates)).
Electron major versions arrive as separate pull requests: check the player (offline cache, exit lock, web pages) before merging one.

## Releasing
1. Update `version` in `package.json` and `desktop/package.json`, and add an entry to `CHANGELOG.md`.
2. Commit, then tag: `git tag v0.2.0 && git push --tags`.
3. The *Build* workflow produces the installers. Attach them to a GitHub Release.
