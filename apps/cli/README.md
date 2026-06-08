# @jander99/overture

`overture` is a CLI utility that keeps your MCP (Model Context Protocol) server
configurations in sync across every installed LLM coding platform on your
machine. This README is the package-local copy shipped inside the published
tarball so `npm view @jander99/overture` and `npx @jander99/overture --help`
users can find the essentials.

For full documentation, see the repository README at
<https://github.com/jander99/overture#readme>.

## Install & run

```bash
# Run without installing:
npx @jander99/overture@latest --help

# Install globally:
npm install -g @jander99/overture
overture detect
```

## Requirements

- Node.js >= 24 (the CLI's first published version targets the Node 24 LTS
  baseline)
- npm >= 11.5.1 (npm Trusted Publishing floor)

## Commands

- `overture detect` — print installed MCP-capable platforms and their config
  state.
- `overture detect --json` — full 14-platform inventory with all additive
  fields.
- `overture detect --help` / `overture --help` — print usage and exit 0.

`detect` is read-only: it makes no writes and spawns no subprocesses.

## License

MIT — see [`LICENSE`](LICENSE).
