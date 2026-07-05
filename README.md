# SideCard for Obsidian

[![Obsidian plugin](https://img.shields.io/badge/Obsidian-plugin-7C3AED?logo=obsidian&logoColor=white)](https://community.obsidian.md/plugins/sidecard)
[![Version](https://img.shields.io/github/v/release/shuuul/obsidian-sidecard?label=version)](https://github.com/shuuul/obsidian-sidecard/releases/latest)

SideCard adds a Heptabase-inspired side card panel to Obsidian. It is built for writing and research sessions where you want to keep several notes, PDFs, or images visible at once while you work in the editor.

Instead of constantly switching tabs, you can collect related files as cards in the sidebar, cross-reference them, resize them, pin them, and reorder them as your context changes.

## Why

Heptabase is useful because it makes it easy to work with multiple pieces of context side by side. SideCard brings a lightweight version of that workflow into Obsidian:

- keep multiple source notes open as sidebar cards;
- compare references while writing in another editor tab;
- drag useful tabs into the card panel when they become supporting context;
- turn a card back into a normal Obsidian tab when you need a full editor view.

## Features

- Sidebar card library for Markdown notes, PDFs, and images.
- Search box for adding files from the vault.
- Recent files appear when the search box is focused.
- Markdown cards render with Obsidian's Markdown renderer.
- PDF and image cards preview directly in the sidebar.
- Drag an Obsidian editor tab into the sidebar to convert it into a card.
- Drag a card out of the sidebar to open it as a normal editor tab.
- Reorder cards by dragging the grip handle in the card title bar.
- Resize unpinned cards from the bottom edge.
- Pin cards to lock their body area and height while keeping their position in the list.
- Insert a Markdown reference to a card's source file into the active editor.

## Usage

### Open SideCard

Use either:

- the ribbon icon; or
- the command palette command: **Open**.

SideCard opens in the configured sidebar.

### Add cards with search

1. Click the search box at the top of SideCard.
2. Recent files appear immediately.
3. Type to search your vault.
   - Title/path/frontmatter matches are prioritized.
   - Markdown body matches are used as a fallback.
4. Click a result to add it as a card.

Supported file types:

- Markdown: `.md`
- PDF: `.pdf`
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.avif`, `.bmp`

### Drag an editor tab into the sidebar

You can convert an existing Obsidian tab into a card:

1. Open a note, PDF, or image in a normal Obsidian tab.
2. Drag the tab header into the SideCard sidebar.
3. The plugin creates a card for the tab's file.
4. The original tab is closed, so the file now lives as a sidebar card instead of a main editor tab.

This uses the file path behind the tab. It does not preserve the editor tab's transient state such as cursor position.

### Drag a card back into an editor tab

Drag a card out of SideCard and drop it into the main workspace area. The card opens as a normal Obsidian tab and is removed from the card list.

### Reorder cards

Drag the grip handle on the left side of a card title bar to reorder cards. The order is saved automatically.

Pinned cards keep their current order; pinning a card does not move it to the top.

### Resize cards

Drag the bottom edge of an unpinned card to resize its visible body area.

Pinned cards are locked and cannot be resized until unpinned.

### Pin cards

Use the pin button in a card title bar to lock a card.

Pinned cards:

- keep their current position;
- do not jump to the top;
- cannot be resized;
- disable direct interaction/dragging inside the card body.

You can still reorder the whole pinned card by dragging its title-bar grip.

### Insert a reference

Use the insert-reference button on a card to insert a Markdown link to the card's source file into the active Markdown editor.

### Open the source file

Use the open-source button on a card to open the card's source file in a normal Obsidian tab.

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

For local Obsidian testing, copy `.env.example` to `.env.local` and set `OBSIDIAN_VAULT` to your vault path, then run:

```bash
npm run obsidian:load
```

This builds the plugin, deploys it into the configured vault, reloads Obsidian, enables/reloads the plugin, and opens the SideCard view.

## License

MIT
