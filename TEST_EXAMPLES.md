# Jest Test Examples - Code Snippets

## schemas.spec.ts Examples

### Example 1: Valid McpServer Schema Test

```typescript
it('should validate complete MCP server configuration', () => {
  // Arrange
  const input = {
    command: 'uvx',
    args: ['mcp-server-python-repl'],
    env: { PYTHONPATH: '/usr/local/lib' },
    scope: 'project' as const,
    enabled: true,
  };

  // Act
  const result = McpServerSchema.safeParse(input);

  // Assert
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.command).toBe('uvx');
    expect(result.data.args).toEqual(['mcp-server-python-repl']);
    expect(result.data.env?.PYTHONPATH).toBe('/usr/local/lib');
    expect(result.data.scope).toBe('project');
    expect(result.data.enabled).toBe(true);
  }
});
```

### Example 2: Invalid Input with Error Verification

```typescript
it('should reject non-array args', () => {
  // Arrange
  const input = {
    command: 'test',
    args: 'not-an-array',
    scope: 'project',
  };

  // Act
  const result = McpServerSchema.safeParse(input);

  // Assert
  expect(result.success).toBe(false);
});
```

### Example 3: Default Value Verification

```typescript
it('should default enabled to true', () => {
  // Arrange
  const input = { scope: 'global' as const };

  // Act
  const result = McpServerSchema.safeParse(input);

  // Assert
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.enabled).toBe(true);
  }
});
```

### Example 4: Edge Case - Empty Objects

```typescript
it('should handle empty env object', () => {
  // Arrange
  const input = {
    scope: 'project' as const,
    env: {},
  };

  // Act
  const result = McpServerSchema.safeParse(input);

  // Assert
  expect(result.success).toBe(true);
  if (result.success) {
    expect(Object.keys(result.data.env || {})).toHaveLength(0);
  }
});
```

### Example 5: Complex Nested Validation

```typescript
it('should validate complete configuration', () => {
  // Arrange
  const input = {
    version: '1.0',
    project: {
      name: 'test-project',
      type: 'python-backend',
      description: 'A test project',
    },
    plugins: {
      'python-development': {
        marketplace: 'claude-code-workflows',
        enabled: true,
        mcps: ['python-repl', 'ruff'],
      },
    },
    mcp: {
      'python-repl': {
        command: 'uvx',
        args: ['mcp-server-python-repl'],
        scope: 'project',
        enabled: true,
      },
    },
  };

  // Act
  const result = OvertureConfigSchema.safeParse(input);

  // Assert
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.project?.name).toBe('test-project');
    expect(Object.keys(result.data.plugins)).toContain(
      'python-development'
    );
    expect(Object.keys(result.data.mcp)).toContain('python-repl');
  }
});
```

## errors.spec.ts Examples

### Example 1: Basic Error Instantiation

```typescript
it('should create an OvertureError with message and code', () => {
  // Arrange
  const message = 'Something went wrong';
  const code = 'TEST_ERROR';

  // Act
  const error = new OvertureError(message, code);

  // Assert
  expect(error.message).toBe(message);
  expect(error.code).toBe(code);
  expect(error.name).toBe('OvertureError');
});
```

### Example 2: Custom Exit Code

```typescript
it('should create an OvertureError with custom exitCode', () => {
  // Arrange
  const message = 'Something went wrong';
  const code = 'TEST_ERROR';
  const exitCode = 42;

  // Act
  const error = new OvertureError(message, code, exitCode);

  // Assert
  expect(error.message).toBe(message);
  expect(error.code).toBe(code);
  expect(error.exitCode).toBe(exitCode);
});
```

### Example 3: ConfigError with FilePath

```typescript
it('should create ConfigError with message and filePath', () => {
  // Arrange
  const message = 'Invalid configuration';
  const filePath = '/path/to/.overture/config.yaml';

  // Act
  const error = new ConfigError(message, filePath);

  // Assert
  expect(error.message).toBe(message);
  expect(error.filePath).toBe(filePath);
  expect(error.exitCode).toBe(2); // ConfigError-specific
});
```

### Example 4: ValidationError with Issues

```typescript
it('should create ValidationError with issues array', () => {
  // Arrange
  const message = 'Validation failed';
  const issues = ['Field A is required', 'Field B must be a string'];

  // Act
  const error = new ValidationError(message, issues);

  // Assert
  expect(error.message).toBe(message);
  expect(error.issues).toEqual(issues);
  expect(error.exitCode).toBe(3); // ValidationError-specific
});
```

### Example 5: Error Inheritance Chain

```typescript
it('should verify ConfigError extends OvertureError', () => {
  // Arrange
  const error = new ConfigError('test');

  // Act & Assert
  expect(error instanceof OvertureError).toBe(true);
  expect(error instanceof Error).toBe(true);
});
```

### Example 6: Polymorphic Error Handling

```typescript
it('should catch specific errors as OvertureError', () => {
  // Arrange
  const errors: OvertureError[] = [
    new ConfigError('config error'),
    new ValidationError('validation error'),
    new PluginError('plugin error'),
    new McpError('mcp error'),
  ];

  // Act & Assert
  errors.forEach((error) => {
    expect(error instanceof OvertureError).toBe(true);
    expect(error.code).toBeDefined();
    expect(error.exitCode).toBeGreaterThanOrEqual(1);
  });
});
```

### Example 7: Real-World Error Scenario

```typescript
it('should handle YAML parse errors', () => {
  // Arrange
  const filePath = '.overture/config.yaml';
  const message = 'Failed to parse YAML: invalid mapping';

  // Act
  const error = new ConfigError(message, filePath);

  // Assert
  expect(error.message).toContain('YAML');
  expect(error.filePath).toBe(filePath);
  expect(error.exitCode).toBe(2);
});
```

### Example 8: Plugin Error with Context

```typescript
it('should handle plugin installation failures', () => {
  // Arrange
  const pluginName = 'python-development';
  const message = `Failed to install plugin ${pluginName}`;

  // Act
  const error = new PluginError(message, pluginName);

  // Assert
  expect(error.message).toContain('Failed to install');
  expect(error.pluginName).toBe(pluginName);
  expect(error.exitCode).toBe(4);
});
```

### Example 9: MCP Error with Context

```typescript
it('should handle MCP server command not found', () => {
  // Arrange
  const mcpName = 'python-repl';
  const message = `Command for MCP server not found: ${mcpName}`;

  // Act
  const error = new McpError(message, mcpName);

  // Assert
  expect(error.message).toContain('not found');
  expect(error.mcpName).toBe(mcpName);
  expect(error.exitCode).toBe(5);
});
```

### Example 10: Error Type Distinction

```typescript
it('should distinguish errors by type', () => {
  // Arrange
  const configErr = new ConfigError('test');
  const validErr = new ValidationError('test');
  const plugErr = new PluginError('test');
  const mcpErr = new McpError('test');

  // Act & Assert
  expect(configErr.code).toBe('CONFIG_ERROR');
  expect(validErr.code).toBe('VALIDATION_ERROR');
  expect(plugErr.code).toBe('PLUGIN_ERROR');
  expect(mcpErr.code).toBe('MCP_ERROR');
});
```

## Test Organization Patterns

### Pattern 1: Organize by Schema/Class

```typescript
describe('Domain: Schemas', () => {
  describe('McpServerSchema', () => {
    describe('Valid inputs', () => {
      // Tests for valid cases
    });

    describe('Invalid inputs', () => {
      // Tests for rejection cases
    });

    describe('Edge cases', () => {
      // Tests for boundary conditions
    });
  });
});
```

### Pattern 2: Organize Error Tests by Lifecycle

```typescript
describe('ConfigError', () => {
  describe('Instantiation', () => {
    // Tests for creation and initialization
  });

  describe('Properties', () => {
    // Tests for property access and modification
  });

  describe('Use cases', () => {
    // Tests for real-world scenarios
  });
});
```

## Common Test Assertions

### Schema Validation Assertions

```typescript
// Success case
expect(result.success).toBe(true);
if (result.success) {
  expect(result.data.field).toBe(expectedValue);
}

// Failure case
expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error.issues.length).toBeGreaterThan(0);
}
```

### Error Class Assertions

```typescript
// Basic properties
expect(error.message).toBe(expectedMessage);
expect(error.code).toBe(expectedCode);
expect(error.exitCode).toBe(expectedExitCode);

// Inheritance
expect(error instanceof OvertureError).toBe(true);
expect(error instanceof Error).toBe(true);

// Custom properties
expect(error.filePath).toBe(expectedPath);
expect(error.pluginName).toBe(expectedName);
expect(error.issues).toEqual(expectedIssues);
```

## Running the Tests

### All domain tests
```bash
nx test @overture/cli --testFile="src/domain/*.spec.ts"
```

### Specific test file
```bash
nx test @overture/cli --testFile="src/domain/schemas.spec.ts"
```

### Specific test suite
```bash
nx test @overture/cli --testNamePattern="McpServerSchema"
```

### Specific test case
```bash
nx test @overture/cli --testNamePattern="should validate complete MCP"
```

### Watch mode
```bash
nx test @overture/cli --watch
```

### With coverage
```bash
nx test @overture/cli --coverage
```

## Test Characteristics

### Arrangement Phase
- Creates minimal, focused test data
- Uses realistic values when appropriate
- Includes comments explaining complex setups
- Avoids test interdependencies

### Action Phase
- Single, clear operation being tested
- No side effects or hidden logic
- Uses standard library methods (safeParse, constructor)
- Captures result for assertion

### Assertion Phase
- Multiple assertions when needed for clarity
- Uses specific matchers (toBe, toEqual, toContain)
- Checks both positive and negative conditions
- Includes guard clauses for type safety

## Best Practices Demonstrated

1. **Clear Test Names** - Describes what is being tested and expected result
2. **AAA Pattern** - Organized into Arrange, Act, Assert phases
3. **Single Responsibility** - Each test verifies one behavior
4. **No Test Interdependencies** - Tests can run in any order
5. **Meaningful Assertions** - Checks specific values and properties
6. **Edge Case Coverage** - Tests boundaries and special cases
7. **Error Scenarios** - Tests both success and failure paths
8. **Real-World Examples** - Uses realistic data and scenarios
9. **Comments Where Needed** - Explains non-obvious test setup
10. **Consistent Formatting** - Standard code style throughout
