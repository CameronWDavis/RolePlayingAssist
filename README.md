# Grimoire

A free, browser-only D&D 5e companion: character sheets, a rules compendium and a dice roller.
No accounts. Characters are saved in your browser's local storage (use Export to back them up).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

`npm run build` makes a static site in `dist/` that you can host anywhere (Cloudflare Pages, Netlify, Vercel).

## Tests

```bash
npm test
```

Runs the Vitest suite (dice parser, character math, import cleanup, homebrew packs, and sanity checks on the SRD data).
Use `npm run test:watch` to re-run on every save.

Tests run automatically in two places:

- **Before every commit**, via the git hook in `.githooks/pre-commit` (enabled by `npm install`). A failing test stops the commit.
  In a real emergency, `git commit --no-verify` skips it.
- **Before every deploy**, because `npm run build` runs the tests first. If they fail, the build fails and the live site keeps the last good version.

## Loading

Pages load on demand, and the big SRD lists (spells, monsters, magic items) are in `src/data/library.ts`, which only the
compendium, character sheet and homebrew editor import. The home page and character list stay light, so don't import
`data/library` from anything that loads on every page (the app shell, stores, `lib/character.ts`).

## What's in v0.1

- **Compendium**: 319 spells, 334 monsters, 239 magic items, 237 pieces of equipment, 12 classes, 9 races, backgrounds, feats, 15 conditions, and the SRD's rules chapters (33 sections: combat, adventuring, spellcasting, traps, poisons, madness, the planes...). Search and filters; the Rules and Conditions search looks through the full text. Clickable dice in monster stat blocks.
- **Dice roller**: d4 to d100 pools, modifiers, advantage/disadvantage, `4d6kh3`-style expressions, roll history. A floating d20 button opens the tray on every page.
- **Character sheet**: race/subrace, class, subclass, level 1–20, ability scores (standard array or 4d6 rolls), saves, skills with expertise, HP/temp HP/death saves/hit dice/long rest, AC from worn armor and shield, weapon attacks, spell slots and spell list, inventory and coins, features and traits, notes. Import/export as JSON.
- **Homebrew**: create magic items, spells, monsters, subclasses, races (with subraces), backgrounds and feats, with a live preview. They appear in the compendium (with a Source filter and an HB tag) and on the character sheet: homebrew races and feats add their ability score increases, races set speed, and backgrounds grant their skills. Any SRD entry can be copied as a starting point. Export/import homebrew packs (`.json`) to share with your table; re-importing a pack updates entries instead of duplicating them.

## Project layout

- `data-raw/`: original SRD JSON from [5e-bits/5e-database](https://github.com/5e-bits/5e-database)
- `scripts/build-data.mjs`: turns `data-raw/` into the lean files in `src/data/` (`npm run build:data`)
- `src/lib/`: dice parser, character rules math, storage
- `src/components/`: dice system, character store, shared UI
- `src/pages/`: Home, Compendium, Characters, Character sheet

## Content and licensing

All game content comes from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode). The required attribution is in the site footer.

The JSON version of that content comes from [5e-database](https://github.com/5e-bits/5e-database) by Adrian Padua,
Christopher Ward and contributors, used under the MIT License. Its license text is kept in
[data-raw/LICENSE-5e-database.md](data-raw/LICENSE-5e-database.md).
Don't add non-SRD material (other subclasses, named settings, product-identity monsters) to the built-in data.
That belongs in user-created homebrew instead.
