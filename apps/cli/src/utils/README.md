# Utils

Shared utility functions and helpers.

## Purpose

This directory contains pure utility functions that are used across multiple layers: logging, formatting, prompts, and general helpers.

## Structure

```
utils/
├── logger.ts          # Chalk-based logging utilities
├── prompts.ts         # Inquirer prompt helpers
├── format.ts          # String formatting utilities
├── validation.ts      # Generic validation helpers
└── common.ts          # Miscellaneous utilities
```

## Responsibilities

- **Logging**: Colorized console output with different log levels
- **User Prompts**: Interactive CLI prompts (inquirer)
- **Formatting**: String formatting, table output, diff display
- **Validation**: Generic validation functions (not domain-specific)

## Guidelines

- Functions should be **pure** where possible (no side effects)
- No business logic (belongs in `core/`)
- No domain logic (belongs in `domain/`)
- Can depend on `domain/` for types and errors only

## Version

**Overture v0.1+ (expanded in v0.2)**
