# Grimoire

A free, browser-only D&D 5e companion: character sheets, a rules compendium and a dice roller.
No accounts. Characters are saved in your browser's local storage (use Export to back them up).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

`npm run build` makes a static site in `dist/` that you can host anywhere (Netlify, Vercel, GitHub Pages).

## What's in v0.1

- **Compendium**: 319 spells, 334 monsters, 239 magic items, 237 pieces of equipment, 12 classes, 9 races, 15 conditions. Search and filters; clickable dice in monster stat blocks.
- **Dice roller**: d4 to d100 pools, modifiers, advantage/disadvantage, `4d6kh3`-style expressions, roll history. A floating d20 button opens the tray on every page.
- **Character sheet**: race/subrace, class, level 1–20, ability scores (standard array or 4d6 rolls), saves, skills with expertise, HP/temp HP/death saves/hit dice/long rest, AC from worn armor and shield, weapon attacks, spell slots and spell list, inventory and coins, features and traits, notes. Import/export as JSON.

## Project layout

- `data-raw/`: original SRD JSON from [5e-bits/5e-database](https://github.com/5e-bits/5e-database)
- `scripts/build-data.mjs`: turns `data-raw/` into the lean files in `src/data/` (`npm run build:data`)
- `src/lib/`: dice parser, character rules math, storage
- `src/components/`: dice system, character store, shared UI
- `src/pages/`: Home, Compendium, Characters, Character sheet

## Content and licensing

All game content comes from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode). The required attribution is in the site footer.
Don't add non-SRD material (other subclasses, named settings, product-identity monsters) to the built-in data.
That belongs in user-created homebrew instead.
