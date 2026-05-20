# AGENTS.md — libs/core/plugin/src/lib

Claude Code plugin management: detect, install, export plugins.

## Key Files

```
plugin/src/lib/
├── plugin-detector.ts    # 425L — finds installed Claude Code plugins
├── plugin-installer.ts   # 387L — installs plugins from config
├── plugin-exporter.ts    # 424L — exports current plugin state to config
└── plugin-types.ts       # Internal plugin types (see also @overture/config-types)
```

## PluginDetector

Scans Claude Code's plugin directories to find installed plugins. Returns list of `DetectedPlugin` objects with name, version, path.

## PluginInstaller

Installs plugins defined in `config.yaml` under `plugins:` section. Handles:

- npm package plugins (installs via process execution)
- Local path plugins (copies or symlinks)
- Version conflict detection

## PluginExporter

Reads currently installed plugins and generates config YAML snippet. Used by `overture plugin export`.

## Plugin Config Shape

```yaml
# In .overture/config.yaml:
plugins:
  - name: my-plugin
    source: npm:@scope/my-plugin
    version: '^1.0.0'
```

## Invariants

- All filesystem ops via `FilesystemPort`, process exec via `ProcessPort`
- No `node:*` imports
- PluginInstaller never modifies files outside designated plugin directory
