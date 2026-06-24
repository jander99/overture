# @jander99/overture

`overture` is a CLI utility that scans your machine for MCP-capable LLM coding
platforms and reports the state of each platform's MCP server configuration.
This README is the package-local copy shipped inside the published tarball so
`npm view @jander99/overture` and `npx @jander99/overture --help` users can
find the essentials.

For full documentation, see the repository README at
<https://github.com/jander99/overture#readme>.

## Install & run

```bash
# Run without installing (uses the latest published version):
npx @jander99/overture@latest --help
```

## Requirements

- Node.js >= 24 (the CLI's first published version targets the Node 24 LTS
  baseline)

## Commands

- `overture detect` — print installed MCP-capable platforms and their config
  state.
- `overture detect --json` — full 4-platform inventory with all additive
  fields.
- `overture config show` — print the resolved user-level `overture.jsonc`.
- `overture bootstrap` (no flag, D3 one-time setup) — walk pickable
  conflicts one at a time, apply the chosen candidate or `skip` in memory,
  write the canonical `overture.jsonc` to the resolved XDG path on success,
  and print `Wrote config: <path>`. Does NOT modify any agent config. Exits
  `2` when stdin is not a TTY.
- `overture bootstrap --dry-run [--json]` — preview the canonical bootstrap
  proposal without writing any files.
- `overture detect --help` / `overture --help` — print usage and exit 0.

`detect` is read-only: it makes no writes and spawns no subprocesses.
