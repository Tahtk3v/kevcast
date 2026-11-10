# Development

## Prerequisites
- Node.js 26 LTS (the server supports 20 and newer; CI and the installers use 26)
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

## Translations

The interface is available in English, Dutch and German. The English text is the key:

```js
t('Upload files')                                // → "Bestanden uploaden" in Dutch
t('Welcome to {orgName}', { orgName })           // placeholders in {braces}
tn(count, '{n} screen', '{n} screens')           // singular / plural ({n} is the count)
```

- `shared/i18n.js` picks the language (`navigator.languages`, or the choice under Settings stored in the browser) and
  loads `shared/lang/<lang>.js`. It is used by the Web Studio, the player and the start page. Static HTML uses
  `data-i18n` (text) or `data-i18n-html` (markup) on the element.
- Server error messages are English and translated in the Web Studio, so send fixed texts from the server.
- The desktop apps' menus, dialogs and connect window use `desktop/common/i18n.js`, which follows the OS language.
- `npm test` (`test/i18n.test.js`) fails when a `t()`/`tn()` text or a `data-i18n` element has no Dutch or German
  translation, or when a translation drops a `{placeholder}` or `<b>` tag. Add the missing entries to `shared/lang/nl.js`
  and `shared/lang/de.js`.
- **Another language:** copy `shared/lang/nl.js` to `shared/lang/<code>.js`, translate it, add the code to `SUPPORTED`
  and `NAMES` in `shared/i18n.js` (and to `desktop/common/i18n.js`), add it to the service worker's file list
  (`public/player/sw.js`) and to the languages checked in `test/i18n.test.js`.

## Dependency updates
Dependabot ([`.github/dependabot.yml`](../.github/dependabot.yml)) opens pull requests for npm packages (server and desktop)
and GitHub Actions. Security fixes arrive as soon as an advisory is published. Enable it under
**Settings → Code security** (see [SECURITY.md](../SECURITY.md#dependency-updates)).
Electron major versions arrive as separate pull requests: check the player (offline cache, exit lock, web pages) before merging one.

## Releasing
1. Update `version` in `package.json` and `desktop/package.json` (`npm version x.y.z --no-git-tag-version` in both folders).
2. Add a `## [x.y.z] - date` section to `CHANGELOG.md`. It becomes the release notes.
3. Merge to `main`, then either:
   - on GitHub: **Actions → Build → Run workflow**, branch `main`, tick **release**, then **Run workflow**. This creates the `vx.y.z` tag itself, or
   - tag the merge commit and push the tag:
     ```bash
     git tag v0.2.1
     git push origin v0.2.1
     ```
4. The *Build* workflow:
   - builds every installer on Windows, macOS and Linux
   - checks the version
   - publishes the **GitHub Release** with all installers attached and the changelog section as notes

   It refuses to publish a version that already has a release, so bump the version first.
