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
7. open the Card Library view
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

## Verification expectations

- Small UI/code changes: run `npm run obsidian:load`.
- Build-only or manifest changes: run `npm run obsidian:load` because Obsidian must rescan plugin metadata.
- If Obsidian CLI is unavailable or offline, run at least `npm run build` and state that live reload was not verified.
