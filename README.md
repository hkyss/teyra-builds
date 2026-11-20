# Teyra builds

Games and builds for the Teyra launcher. Teyra downloads the latest release at start, so a build can change between launcher releases.

| Path | Holds |
|---|---|
| `games/<id>.json` | a game in the current format: title, install folder, its id in each store, and what its builds share |
| `builds/<id>.json` | a build in the current format, without what its game already gives |
| `formats/<n>/` | copies of games and builds in an older format |
| `schema/` | JSON Schema of both files, for writing them by hand; no check reads it |

A file is named after its `id`. Ids starting with `own-` are left to the builds players make in Teyra.

## Games and builds

`stores` maps each store that sells the game to its id there. A launcher that does not know one of the stores reads the game without it and lists that store as skipped.

A game's `defaults` hold what every build of that game needs: the executable, the Nexus domain, Mod Organizer, `modArchive`, the INI files, the editor. A build says only what is its own or differs from the game.

### How a build is laid over its game

Teyra reads a build on top of its game's defaults, field by field:

- An object is merged with the game's one key by key, at any depth.
- `null` removes what the game gives: `"editor": null` drops the game's editor, `"languageNames": { "polish": null }` drops one name.
- `options`, `mods`, `patches`, `tools`, `profiles` and `ini.files` are merged by name, which is `id` for options and `name` for the rest. An item with the name of one of the game's takes its place. An item with a new name goes after the game's items. `{ "remove": "<name>" }` takes the game's item out.
- Any other list, such as `systems`, `files`, `ini.settings` and `userSettings`, replaces the game's list, and so does any other value. Those lists have no name to match items by: a setting can appear twice with different `when`.

An item is replaced whole. Nothing inside it is merged, so a build that changes one field of a game's mod writes out the whole mod.

The build's items are read top to bottom. Order matters for `mods`, which are installed in that order, and for `profiles`, where the first is the default. To move one of the game's items to the end, remove it and then add it again.

With a game whose only profile is `Base`, this build drops the editor and the language option, gives `Base` its own mods and adds `Test` after it:

```json
"editor": null,
"options": [{ "remove": "language" }],
"profiles": [
  { "name": "Base", "mods": ["My Mod"] },
  { "name": "Test", "mods": [] }
]
```

Teyra refuses a build that removes an item the list doesn't have or names one item twice in a list.

An empty build a player starts in Teyra is made from the defaults alone, so they need what every build needs: at least `systems`, `nexusDomain`, `game`, `modOrganizer` and one profile. A game whose defaults lack any of these offers no empty build.

`defaults` take any build field except these, which belong to each build alone: `id`, `title`, `version`, `folder`, `gameId`, `category`, `description`, `art`, `authors`, `license` and `basedOn`. `schema/build.json` describes a build after the merge.

The schema lists every field. A few need more than their name:

- `folder` is where the build goes inside the game's folder. Two builds of one game cannot share it.
- `category`: `advanced` is a base for your own mods, `readyToPlay` is played as it is.
- INI values and user settings may use `{screen.width}`, `{screen.height}`, `{game.language}`, `{game.locale}` and `{option.<id>}`. A setting that uses the language or the locale is not written when the build has no language option.
- `languageNames` says how the game spells each language, which is what `{game.language}` is filled with. A language that is not listed is filled in as its Steam name.
- `game` holds the game's `executable` and the `version` a build expects to find. When a store sells another version or names the file differently, `game.stores` says so for that store, and the rest comes from the common values: `"game": { "executable": "SkyrimSE.exe", "version": "1.7.104.0", "stores": { "gog": { "version": "1.6.1179.0" } } }`. Teyra checks the copy against the values of the store it came from.
- `modOrganizer.editions` names the Mod Organizer edition for each store. `game_edition` is written only for a store listed there.
- `modOrganizer.pluginList` says how the game lists its plugins: `plain` for `plugins.txt` with one plugin per line, `starred` when Mod Organizer marks the active ones with `*`, and `none` for a game without plugins. With `none` a profile gets no `plugins.txt` or `loadorder.txt`, and a profile that lists plugins is refused. Teyra looks for a profile's plugins in `modArchive.dataFolder`, or at the top of the game folder when there is none.
- `modOrganizer.profileSettings` is written into each profile's `settings.ini`, section by section: `{ "General": { "LocalSaves": "true" } }` sets `LocalSaves=true` under `[General]`.
- `downgrade` patches the build's copy of the game to another version. Its hashes belong to one store's files, so a downgrade usually has `"when": { "store": ["steam"] }`. For a copy from any other store the downgrade is skipped.
- A launcher that doesn't know a store reads `game.stores`, `editor.stores` and `modOrganizer.editions` without it.

`modArchive` tells Teyra where a mod's files start inside its archive. By default Teyra steps through every lone top folder. `rootFolders` stops it above the named folders, `dataFolder` takes the contents of the game's data folder and drops what lies next to it, and `keepTopFolder` keeps the top folder. The Mod Organizer archive and mods with `"target": "manager"` ignore it.

A mod's `target` says where its files go. Without it they go into the mod's own folder. `"target": "game"` puts the loose files at the top of the archive into the game copy, such as a script extender's loader, and the folders still go into the mod's folder. `"target": "manager"` puts the whole archive into Mod Organizer's own folder, such as a plugin for Mod Organizer. Such a mod needs `expect`, the files that show it is installed, and no profile may list it.

## Options

`options` lists what a player can choose in a build. Each option has an `id`, a `kind`, the `values` it offers and a `default`, which is one of those values. `title` names the option and `labels` name its values, both keyed by interface language like `description`:

```json
"options": [
  {
    "id": "textures",
    "kind": "choice",
    "values": ["standard", "sharp"],
    "default": "standard",
    "title": { "en": "Textures", "ru": "Текстуры" },
    "labels": { "sharp": { "en": "Sharp", "ru": "Чёткие" } }
  }
]
```

A `choice` option takes the value the player picked, or its `default` if they picked none. A `language` option offers Steam language names. If the player picked none, it takes the language the store reports for the game copy, as long as the option offers it, and its `default` otherwise. With `"followsStore": true` the player can't pick while the store reports a language: the language is whatever the store reports. A copy that reports none, such as one from Epic or a folder the player chose, leaves the choice to the player. A build has at most one language option. A game's `defaults` usually hold one with every language the game ships in. A build that offers fewer lists its own under the same `id`, which replaces the game's.

A `profile` option picks the profile Play starts. Its values are the build's `profiles` in their order and its default is the first, so leave `values` and `default` out. `labels` can still give a profile a clearer name in each language:

```json
{ "id": "profile", "kind": "profile", "labels": { "Base": { "ru": "Основной" }, "Test": { "ru": "Тестовый" } } }
```

A build has at most one profile option. Without one, Play starts the first profile. Every profile is written on install whichever one the player picks, so nothing can depend on this option: no `when` names it and no value uses `{option.<id>}` with its id. To put a mod or a plugin in one profile only, list it in that profile.

A mod, a profile plugin, an INI file, an INI setting, a user setting, a written file, a patch, a tool, a file of a tool or the downgrade can say when it applies. `when` maps option ids to the values it applies for, and every option it names must have one of them. Two more names work like options but are about the install, and no option can take them: `store` is the store the game copy came from (`steam`, `gog`, `epic`), and `system` is the system Teyra runs on (`windows`, `linux`, `macos`). `"when": { "store": ["gog"] }` picks a script extender file made for the GOG executable. A plugin with a condition is written as an object instead of a plain name:

```json
{ "name": "YUP RUS - Base Game + All DLC.esm", "when": { "language": ["russian"] } }
```

Teyra refuses a build whose `when` names an option it doesn't have, a value that option doesn't offer or a system it doesn't know. A store it doesn't know never matches. Until Teyra has found the game copy it doesn't know the store, so a build with a `when` on `store` installs nothing before that.

When the player changes an option, Teyra takes back what the old choice put in. A plugin or a mod that no longer applies leaves the profile, and a written file, a file of a tool or an INI file that no longer applies is deleted. A mod made only of written files leaves the profile when none of its files applies. Plugins and mods the player added in Mod Organizer stay: Teyra only touches the names a profile lists under some choice.

## Tools

`tools` lists the programs Teyra runs on an installed build, in the order given, once the profiles are written. Each one runs through Mod Organizer, so it sees the build's mods the way the game does, and writes its results into a mod of its own:

```json
{
  "name": "BodySlide",
  "mod": "BodySlide and Outfit Studio",
  "executable": "CalienteTools/BodySlide/BodySlide.exe",
  "arguments": "--groupbuild \"CBBE,3BA\" -t \"{tool.output}\" -p \"- Zeroed Sliders -\" -q --tri",
  "output": "BodySlide Output",
  "done": "meshes"
}
```

- `name` is what Teyra shows for the step. Two tools in a build can't have the same name.
- `mod` is the mod in `mods` that holds the program, and `executable` is the program's path inside it.
- `arguments` is the command line. On top of the placeholders settings take, it can use `{game.folder}` for the build's copy of the game and `{tool.output}` for the folder of the output mod.
- `output` is the mod the tool writes into. It can't be one of `mods`, and two tools can't write into the same one. Profiles list it like any other mod.
- `done` is a file or folder inside `output` that exists once the tool has run.
- `files` are written into `output` before the run. Each has a `path`, a `content`, written the same way as the build's own `files`, and an optional `when`.
- `profile` is the profile to run under. Without it the build's first profile is used.
- `when` works as above. When a tool doesn't apply, profiles leave its output out.

Teyra runs a tool again when its command line, its files or the build's mods change.

## Credit

A build's `authors` are the people who wrote it, each with a `name` and, if they like, a `link` to an https page. `license` says on what terms others may use it. Every build here needs at least one author, and the check refuses one without. Every build here is GPL-3.0, like the repository.

When a player makes a build of their own from one of these, Teyra writes `basedOn` into it: the id, title, version, authors and licence of the build it was copied from, and that build's own `basedOn` inside. A copy of a copy keeps the whole chain. The new build's `authors` hold the player's name, if they give one, and it keeps the licence of the build it came from. Nothing in Teyra lets anyone edit or remove `basedOn`.

A build added here that started from another build keeps its `basedOn`. If a build in the chain is also in this catalog, the chain must still name that build's authors, or the check refuses it.

## Format

Every game and build has a `format`. It must equal the `const` in `schema/game.json` and `schema/build.json`, which is one number for both. A launcher reads formats up to the one it knows and skips newer files, saying why.

To keep a game or a build for launchers that read only an older format, put a copy of it in that format into `formats/<n>/games/` or `formats/<n>/builds/`. A launcher takes the newest copy of each game and each build that it can read. It reads a build on top of the copy of its game in the same format, never a newer one, so a build in `formats/<n>/builds/` needs its game in `formats/<n>/games/`; the check refuses it otherwise. The release puts these copies into `catalog.json` next to the current files. There are none now.

`catalog.json` holds `version`, `games` and `builds`. A launcher reads those three and ignores any other key, so a later release can add one without breaking older launchers.

## Check

The rules are the launcher's own: the check reads this folder with the code Teyra reads a released catalog with, and lists every problem it finds with its file. It also holds what only this catalog asks for, such as the file name being the id and every build naming an author. That code is in the launcher, so run its check with `teyra-cli`, built from the launcher's current `dev`:

```sh
teyra-cli check .
```

`node scripts/check.mjs` runs the same command, finding `teyra-cli` on `PATH` or in the `TEYRA_CLI` variable, and stops with an error if it is missing. The workflows can't build the launcher, so they pass `--without-launcher`: the script then only reads the JSON files, says it did not check the launcher's rules and does not fail on that. A change is checked against the rules before it is pushed, not by the workflow.

## Release

```sh
gh workflow run release.yml -f level=patch
```

`level` is `patch` for fixes, `minor` for new builds or games and `major` for a new format. The workflow reads the files, writes every game and build into `catalog.json` and attaches it to the next release, such as `v1.2.0`. Pushing to `main` alone changes nothing for players.

## Licence

GPL-3.0, see [LICENSE](LICENSE).
