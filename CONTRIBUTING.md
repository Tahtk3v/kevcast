# Contributing to KevCast

Thanks for helping make signage easier! Bug reports, ideas, documentation fixes and code are all welcome.

## Reporting bugs and ideas
- Search [existing issues](https://github.com/tahtk3v/kevcast/issues) first.
- Use the **Bug report** or **Feature request** template.
- For bugs, include:
  - the server OS and KevCast version (**Settings → Server**)
  - the player type (app or which browser)
  - the steps to reproduce
- If PowerPoint conversion is the problem, attach a sample file if you can share it.
- Security problems: please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Making changes
1. Fork the repository and create a branch: `git checkout -b fix/ticker-speed`.
2. Set up and run the project. See [docs/development.md](docs/development.md).
3. Keep changes focused. One feature or fix per pull request.
4. Run `npm test`. Add tests for schedule logic (`test/schedule.test.js`) and API changes (`test/api.test.js`).
5. Update the docs in `docs/` and add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
6. Open a pull request and fill in the template.

## Guidelines
- **Easy to install.** No native npm modules or database servers in the server. Think twice before adding a dependency.
- **Easy to use.** Write UI text for non-technical users. Prefer sensible defaults over options.
- **Screens never go black.** Players must keep working when the server or network is down.
- **Style.** Two-space indentation, single quotes, semicolons, and small functions with a comment when *why* isn't obvious.
- **Commits.** Use the imperative mood ("Add group rename"), with a body explaining why when it isn't obvious.

## License
By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
