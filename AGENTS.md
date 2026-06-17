# Repository Guidelines

## Project Structure & Module Organization

This repository contains a small static site plus a Google Apps Script contact-form backend.

- `docs/index.html` is the published static page and contains the page CSS inline.
- `docs/contact.js` owns modal behavior, form submission, and browser/CommonJS exports for tests.
- `docs/images/` stores site image assets.
- `apps-script/Code.js` contains Apps Script web app handlers and helpers.
- `apps-script/appsscript.json` stores Apps Script runtime and web app configuration.
- `test/` contains Node test files for the frontend and Apps Script logic.
- `.vscode/tasks.json` includes a task for pushing Apps Script with `clasp`.

## Build, Test, and Development Commands

- `npm test`: runs all tests with Node's built-in `node --test` runner.
- `node --test test/frontend.test.js`: runs only frontend behavior tests.
- `node --test test/apps-script.test.js`: runs only Apps Script unit tests.
- `clasp push` from `apps-script/`: pushes Apps Script source to the bound Google project. Local clasp config is intentionally ignored.

The static site can be inspected by opening `docs/index.html` directly in a browser.

## Coding Style & Naming Conventions

Use plain JavaScript with CommonJS exports where tests need direct imports. Keep browser code dependency-free and compatible with the current static hosting setup. Existing indentation is four spaces in `docs/contact.js` and tests, and two spaces in `apps-script/Code.js`; match the file you edit. Prefer descriptive camelCase names for functions and variables, and UPPER_SNAKE_CASE for shared constants such as `SUBMISSION_HEADERS`.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; do not add external test dependencies unless necessary. Place new tests under `test/` with the `.test.js` suffix. For frontend changes, cover modal accessibility, focus behavior, and form submission payloads. For Apps Script changes, mock Apps Script globals as existing tests do and verify both success and error responses.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, for example `Add accessible focus styles` or `Improve contact modal accessibility`. Keep commits focused on one behavior or fix. Pull requests should include a concise description, test results such as `npm test`, linked issues when relevant, and screenshots for visible changes to `docs/index.html`.

## Security & Configuration Tips

Do not commit `apps-script/.clasp.json`, `.clasprc.json`, credentials, or deployment tokens. When changing the web app URL in `docs/contact.js`, verify the Apps Script deployment and rerun the form submission tests.
