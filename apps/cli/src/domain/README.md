# Domain

Domain models, types, and validation schemas.

## Purpose

This directory contains pure domain logic with no external dependencies: TypeScript interfaces, Zod schemas, constants, enums, and error definitions.

## Structure

```
domain/
├── types.ts                   # Core type definitions (v0.1)
├── schemas.ts                 # Zod validation schemas (v0.1)
├── config-v2.types.ts         # v2.0 configuration types
├── config-v2.schema.ts        # v2.0 Zod schemas
├── constants.ts               # Application constants
├── errors.ts                  # Custom error classes
└── enums.ts                   # Enums and discriminated unions
```

## Principles

**No Dependencies**: Domain layer has zero dependencies on infrastructure, core, or CLI layers.

**Pure Logic**: All code in this directory is pure TypeScript with no side effects.

**Schema-First**: All types are derived from Zod schemas where possible using `z.infer<typeof schema>`.

**Validation**: Zod schemas provide runtime validation with helpful error messages.

## Type Definitions

- **v0.1 Types**: `OvertureConfig`, `PluginConfig`, `McpServerConfig` (project-level only)
- **v0.2 Types**: `OvertureConfigV2`, `McpServerConfigV2`, `ClientConfig` (user + project, multi-client)

## Version

**Overture v0.1+ (expanded in v0.2)**
