# Obsidian Sidecard Developer Guide

## Build and live-load workflow

This is an Obsidian community plugin. After changing TypeScript, CSS, manifest, or build configuration, automatically build and load the plugin into Obsidian unless the user explicitly asks not to.

Use the one-shot workflow:

```bash
npm run obsidian:load
```

That command performs:

1. `npm run build`
2. copy `main.js`, `manifest.json`, and `styles.css` into the configured vault plugin folder
3. add `sidecard` to the vault's `community-plugins.json` if needed
4. `obsidian reload`
5. `obsidian plugin:enable id=sidecard`
6. `obsidian plugin:reload id=sidecard`
7. open the SideCard view
8. print `obsidian dev:errors`

`npm run build` also auto-deploys artifacts when `OBSIDIAN_VAULT` is configured.

## Local vault configuration

Create `.env.local` from `.env.example`:

```env
OBSIDIAN_VAULT=/absolute/path/to/your/vault
```

`.env.local` is intentionally git-ignored. If it is missing, `npm run obsidian:load` tries to use the currently open Obsidian vault from Obsidian's app config.

## Deployment rules

- Deploy only `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/sidecard/`.
- Preserve Obsidian-created `data.json`.
- Do not copy `node_modules`, source files, scripts, or package metadata into the vault plugin folder.
- After deploy/reload, check `obsidian dev:errors`; report any plugin errors instead of claiming success.

## Release workflow

Follow the Obsidian plugin release convention used by Pivi:

1. Ensure `manifest.json`, `package.json`, and `versions.json` all describe the release version.
   - `manifest.json.version` must use semantic versioning in `x.y.z` format.
   - The GitHub release tag must match `manifest.json.version` exactly.
   - Obsidian plugin release tags must not use a leading `v`; use `0.1.0`, not `v0.1.0`.
2. Validate `manifest.json` against the Obsidian manifest rules:
   - required fields: `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly`;
   - `id` contains only lowercase letters and hyphens;
   - `id` does not contain `obsidian` and does not end with `plugin`;
   - optional URL fields should be omitted unless they contain valid URLs.
3. Run the pre-release checks:

   ```bash
   npm test -- --runInBand
   npm run build
   npm run obsidian:load
   ```

4. Commit and push the source changes. Do not commit generated `main.js`; it is intentionally git-ignored.
5. Create or update the GitHub release using the exact version tag and upload only the Obsidian release artifacts:

   ```bash
   gh release create <version> main.js manifest.json styles.css \
     --repo shuuul/obsidian-sidecard \
     --target main \
     --title "<version>" \
     --notes-file <release-notes.md>
   ```

   If the release already exists, use `gh release upload <version> main.js manifest.json styles.css --clobber` after rebuilding.
6. Verify the release assets are exactly:
   - `main.js`
   - `manifest.json`
   - `styles.css`

## Verification expectations

- Small UI/code changes: run `npm run obsidian:load`.
- Build-only or manifest changes: run `npm run obsidian:load` because Obsidian must rescan plugin metadata.
- If Obsidian CLI is unavailable or offline, run at least `npm run build` and state that live reload was not verified.

## UI copy conventions

- Avoid including the plugin name in settings headings; Obsidian already provides the plugin context.
