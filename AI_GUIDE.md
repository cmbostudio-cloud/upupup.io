# UPUPUP.io AI Guide

This document is a compact map of the codebase for future AI edits.

## Project Shape

- `index.html` loads the game scripts in this order:
  1. `js/logic.js`
  2. `js/map.js`
  3. `js/shared.js`
  4. `js/audio.js`
  5. `js/ui.js`
  6. `js/runtime.js`
  7. `js/game.js`
- The game is a PIXI.js browser game with a menu overlay and a canvas-based playfield.
- No build step is present. Edits are applied directly to source files.
- `editor/` is a separate, static stage-editing tool for JSON-based layouts.

## Main Responsibilities

- `js/logic.js`
  - Core gameplay primitives and collision logic.
  - The `Square` player class lives here.
- `js/map.js`
  - Procedural map generation.
  - Creates sticks, moving sticks, windmills, credits, and portals.
  - Owns chunk generation and visible-object syncing.
- `js/runtime.js`
  - Bootstraps the game session.
  - Creates the PIXI application, camera, score UI, autosave timer, and stage-complete flow.
- `js/ui.js`
  - Menu overlay, stage select, infinite-mode select, settings, and popup UI.
- `js/shared.js`
  - Storage, preferences, save encoding, utility functions, and viewport helpers.
- `js/audio.js`
  - Web Audio sound effects.
- `js/game.js`
  - Menu-to-game entry point and action wiring.
- `editor/`
  - Standalone developer editor for building and exporting stage JSON.
  - `editor/index.html` is the entry page.
  - `editor/editor.js` contains the stage editing logic.
  - `editor/editor.css` contains the editor layout and styling.
  - `editor/data/stages/` is the intended home for exported stage files.

## Runtime Flow

1. `game.js` creates the UI controller.
2. `runtime.js` starts a game session when the user selects a mode or stage.
3. `map.js` generates the world and exposes active objects by camera range.
4. `runtime.js` updates the player, camera, score, and collision checks on each tick.
5. Save data is written through `shared.js` and restored on reload.

## Save Data

- Save version is `SAVE_VERSION = 1` in `js/shared.js`.
- The save payload includes:
  - game mode
  - stage number
  - seed
  - player state
  - map generation state
  - score
  - credits
- If the save structure changes, update both encode/decode logic and any migration assumptions in runtime.

## Portal Notes

- Portals are created in `js/map.js` by `addPortal()`.
- Stage completion is checked in `js/runtime.js`.
- Portal collision now uses rectangle overlap, so visual size and hit logic stay aligned.
- Current portal dimensions are:
  - width: `136`
  - height: `136`
- Portal rendering uses two overlapping rounded-square clusters:
  - `shellA` rotates slowly
  - `shellB` rotates faster
- If you change portal size again, update:
  - `PORTAL_SIZE` in `js/map.js`
  - portal drawing in `drawPortalShape()`
  - stage collision logic in `js/runtime.js`
  - stage placement offset in `createStageOneLayout()`

## Editing Guidelines

- Keep map generation deterministic for a given seed.
- Treat chunk visibility and active-object syncing as separate concerns.
- Preserve existing save data unless a migration is explicitly added.
- When changing interaction geometry, check both visual rendering and collision code.
- Keep UI strings in UTF-8 and avoid mixing text encoding assumptions across files.

## Good Follow-Up Checks

- Start stage 1 and verify the taller portal still sits where expected.
- Run through stage completion to confirm the popup and autosave still work.
- Check that credits, sticks, and windmills still spawn with adequate spacing around the taller portal.
