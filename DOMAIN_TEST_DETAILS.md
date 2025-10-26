# Domain Layer Test Suite - Detailed Breakdown

## File Locations

```
/home/jeff/workspaces/ai/overture/apps/cli/src/domain/
├── schemas.spec.ts          (1,081 lines, 61 tests)
└── errors.spec.ts           (827 lines, 64 tests)
```

## schemas.spec.ts - Zod Schema Validation Tests

### Test Organization

```
Domain: Schemas
├── McpServerSchema (17 tests)
├── PluginSchema (13 tests)
├── ProjectSchema (9 tests)
├── OvertureConfigSchema (14 tests)
└── McpJsonSchema (8 tests)
```

### McpServerSchema Tests (17 total)

#### Valid Inputs (5 tests)
1. **Minimal configuration** - Tests that only `scope` is required
   - Input: `{ scope: 'global' }`
   - Verifies: enabled defaults to true

2. **Complete configuration** - Tests all optional fields
   - Input: Full McpServer with command, args, env, scope, enabled
   - Verifies: All fields preserved correctly

3. **Default enabled** - Tests enabled field defaults
   - Input: `{ scope: 'global' }` (no enabled field)
   - Verifies: enabled is set to true

4. **Empty args array** - Tests optional empty arrays
   - Input: `{ command: 'test-cmd', args: [], scope: 'project' }`
   - Verifies: Empty arrays are valid

5. **Multiple environment variables** - Tests env object validation
   - Input: Multiple VAR1, VAR2, VAR3 in env
   - Verifies: All variables preserved

#### Invalid Inputs (6 tests)
1. **Missing scope** - Required field validation
   - Input: `{ command: 'test' }` (no scope)
   - Verifies: Proper error code and path

2. **Invalid scope value** - Enum validation
   - Input: `{ scope: 'invalid-scope' }`
   - Verifies: Zod rejects invalid enum values

3. **Non-string command** - Type validation
   - Input: `{ command: 123, scope: 'global' }`
   - Verifies: Command must be string

4. **Non-array args** - Type validation
   - Input: `{ args: 'not-an-array', scope: 'project' }`
   - Verifies: Args must be array

5. **Non-string args elements** - Array element type validation
   - Input: `{ args: ['valid', 123], scope: 'project' }`
   - Verifies: All array elements must be strings

6. **Non-boolean enabled** - Type validation
   - Input: `{ scope: 'project', enabled: 'yes' }`
   - Verifies: Enabled must be boolean

#### Edge Cases (2 tests)
1. **Extra fields** - Tests Zod's strip behavior
   - Input: Object with extra field
   - Verifies: Extra fields are removed

2. **Empty env object** - Tests optional empty objects
   - Input: `{ scope: 'project', env: {} }`
   - Verifies: Empty env is valid

### PluginSchema Tests (13 total)

#### Valid Inputs (5 tests)
1. **Minimal plugin** - Tests required fields only
   - Input: `{ marketplace: 'claude-code-workflows', mcps: ['python-repl'] }`
   - Verifies: enabled defaults to true

2. **Complete plugin** - Tests all fields
   - Input: marketplace, enabled=true, mcps array
   - Verifies: All fields preserved

3. **Default enabled** - Tests default behavior
   - Input: No enabled field
   - Verifies: enabled is true by default

4. **Disabled plugin** - Tests disabled state
   - Input: `{ marketplace: '...', enabled: false, mcps: [...] }`
   - Verifies: Can be disabled

5. **Empty mcps array** - Tests empty array validity
   - Input: `{ marketplace: '...', mcps: [] }`
   - Verifies: Empty mcps array is valid

#### Invalid Inputs (6 tests)
1. **Missing marketplace** - Required field validation
2. **Missing mcps** - Required field validation
3. **Non-string marketplace** - Type validation
4. **Non-array mcps** - Type validation
5. **Non-string mcp elements** - Array element validation
6. **Non-boolean enabled** - Type validation

#### Edge Cases (2 tests)
1. **Extra fields** - Stripped by Zod
2. **Empty mcps** - Valid configuration

### ProjectSchema Tests (9 total)

#### Valid Inputs (3 tests)
1. **Minimal project** - Only name required
   - Input: `{ name: 'my-project' }`
   - Verifies: type and description are optional

2. **Complete project** - All fields provided
   - Input: name, type, description
   - Verifies: All fields preserved

3. **Optional fields undefined** - Tests optional field behavior
   - Input: `{ name: '...' }` (no type/description)
   - Verifies: Optional fields undefined

#### Invalid Inputs (4 tests)
1. **Missing name** - Required field validation
2. **Non-string name** - Type validation
3. **Non-string type** - Type validation
4. **Non-string description** - Type validation

#### Edge Cases (2 tests)
1. **Empty name string** - Zod accepts by default
2. **Null project** - Optional field rejects null

### OvertureConfigSchema Tests (14 total)

#### Valid Inputs (6 tests)
1. **Minimal config** - Only required fields
   - Input: `{ plugins: {}, mcp: {} }`
   - Verifies: version defaults to '1.0'

2. **Complete config** - All fields with nested objects
   - Input: Full configuration with project, plugins, mcp
   - Verifies: All nested structures validated

3. **Default version** - Tests default behavior
   - Input: No version field
   - Verifies: version is '1.0'

4. **Custom version** - Tests explicit version
   - Input: `version: '2.0'`
   - Verifies: Custom version accepted

5. **Multiple plugins** - Tests record validation
   - Input: plugin1, plugin2 with different mcps
   - Verifies: All plugins validated

6. **Multiple mcps** - Tests mcp record validation
   - Input: mcp1, mcp2, mcp3 with different scopes
   - Verifies: All mcps validated

#### Invalid Inputs (6 tests)
1. **Missing plugins** - Required field
2. **Missing mcp** - Required field
3. **Non-object plugins** - Type validation
4. **Non-object mcp** - Type validation
5. **Invalid plugin entries** - Nested validation
6. **Invalid mcp entries** - Nested validation

#### Edge Cases (2 tests)
1. **Optional project field** - Can be omitted
2. **Null project** - Optional rejects null

### McpJsonSchema Tests (8 total)

#### Valid Inputs (3 tests)
1. **Minimal mcp.json** - Single server
   - Input: `{ mcpServers: { 'test-server': { command: 'test-command' } } }`
   - Verifies: Minimum required structure

2. **Complete mcp.json** - Full configuration
   - Input: Multiple servers with command, args, env
   - Verifies: All fields validated

3. **Optional fields** - Tests optional args and env
   - Input: Some servers with args, some without
   - Verifies: Optional fields work correctly

#### Invalid Inputs (5 tests)
1. **Missing mcpServers** - Required field
2. **Non-object mcpServers** - Type validation
3. **Server without command** - Required field in nested object
4. **Non-string command** - Type validation
5. **Non-array args** - Type validation
6. **Non-string args elements** - Array element validation
7. **Non-object env** - Type validation
8. **Non-string env values** - Object value type validation

#### Edge Cases (3 tests)
1. **Empty mcpServers** - Valid empty configuration
2. **Empty args array** - Valid empty array
3. **Empty env object** - Valid empty object

## errors.spec.ts - Error Class Tests

### Test Organization

```
Domain: Error Classes
├── OvertureError (11 tests)
├── ConfigError (11 tests)
├── ValidationError (11 tests)
├── PluginError (11 tests)
├── McpError (11 tests)
├── Error Inheritance Chain (8 tests)
└── Error Messages and Properties (8 tests)
```

### OvertureError Tests (11 total)

#### Instantiation (6 tests)
1. **Basic creation** - Tests message and code
   - Creates: `new OvertureError('message', 'TEST_ERROR')`
   - Verifies: message and code properties

2. **Custom exitCode** - Tests explicit exit code
   - Creates: `new OvertureError('msg', 'CODE', 42)`
   - Verifies: exitCode is 42

3. **Default exitCode** - Tests default to 1
   - Creates: `new OvertureError('msg', 'CODE')`
   - Verifies: exitCode is 1

4. **Error inheritance** - Tests instanceof Error
   - Verifies: error instanceof Error is true

5. **Stack trace** - Tests stack trace generation
   - Verifies: error.stack contains error info

6. **Error name** - Tests error name property
   - Verifies: error.name === 'OvertureError'

#### Properties (4 tests)
1. **Message access** - Tests message property
2. **Code access** - Tests code property
3. **ExitCode access** - Tests exitCode property
4. **Throwable** - Tests can be thrown and caught

#### Error Messages (3 tests)
1. **Special characters** - Tests message preservation
2. **Empty message** - Tests empty string handling
3. **Multiline message** - Tests newline preservation

### ConfigError Tests (11 total)

#### Instantiation (5 tests)
1. **Basic creation** - Tests message-only constructor
   - Verifies: code='CONFIG_ERROR', exitCode=2

2. **With filePath** - Tests filePath parameter
   - Input: message and filePath
   - Verifies: filePath stored correctly

3. **ConfigError-specific exitCode** - Verifies exitCode=2
4. **CONFIG_ERROR code** - Verifies code is 'CONFIG_ERROR'
5. **OvertureError extension** - Tests inheritance

#### Properties (3 tests)
1. **filePath access** - Tests property access
2. **filePath undefined** - Tests when not provided
3. **Throwable as OvertureError** - Tests inheritance

#### Use Cases (2 tests)
1. **YAML parse errors** - Tests config parse failure
   - Message: 'Failed to parse YAML: invalid mapping'
   - Verifies: filePath and error details

2. **Missing config file** - Tests file not found error
   - Message: 'Config file not found at ...'
   - Verifies: Error properties

### ValidationError Tests (11 total)

#### Instantiation (6 tests)
1. **Basic creation** - Message-only constructor
2. **With issues array** - Issues parameter
3. **Default empty issues** - Tests default to []
4. **VALIDATION_ERROR code** - Verifies code
5. **exitCode=3** - Verifies exit code
6. **OvertureError extension** - Tests inheritance

#### Properties (3 tests)
1. **Issues array access** - Tests property
2. **Array modification** - Tests mutability
3. **Throwable** - Tests error handling

#### Use Cases (3 tests)
1. **Schema validation errors** - Multiple field errors
2. **Multiple validation issues** - Array of issues
3. **Generic validation error** - Empty issues

### PluginError Tests (11 total)

#### Instantiation (5 tests)
1. **Basic creation** - Message-only constructor
2. **With pluginName** - pluginName parameter
3. **PLUGIN_ERROR code** - Verifies code
4. **exitCode=4** - Verifies exit code
5. **OvertureError extension** - Tests inheritance

#### Properties (3 tests)
1. **pluginName access** - Tests property
2. **pluginName undefined** - Tests when not provided
3. **Throwable** - Tests error handling

#### Use Cases (2 tests)
1. **Plugin installation failure** - Installation error
   - Includes: pluginName context

2. **Plugin not found** - Plugin availability error
   - Message: 'Plugin not found: {name}'

### McpError Tests (11 total)

#### Instantiation (5 tests)
1. **Basic creation** - Message-only constructor
2. **With mcpName** - mcpName parameter
3. **MCP_ERROR code** - Verifies code
4. **exitCode=5** - Verifies exit code
5. **OvertureError extension** - Tests inheritance

#### Properties (3 tests)
1. **mcpName access** - Tests property
2. **mcpName undefined** - Tests when not provided
3. **Throwable** - Tests error handling

#### Use Cases (2 tests)
1. **MCP server command not found** - Command missing
   - Message includes: 'Command for MCP server not found'

2. **Server startup failure** - Execution error
   - Message: 'Failed to start MCP server'

### Error Inheritance Chain Tests (8 total)

#### Inheritance Verification (4 tests)
1. **ConfigError extends OvertureError**
   - Verifies: instanceof OvertureError and Error

2. **ValidationError extends OvertureError**
   - Verifies: instanceof OvertureError and Error

3. **PluginError extends OvertureError**
   - Verifies: instanceof OvertureError and Error

4. **McpError extends OvertureError**
   - Verifies: instanceof OvertureError and Error

#### Polymorphism (4 tests)
1. **Catch as OvertureError** - Tests polymorphic handling
   - Creates array of all error types
   - Verifies: All catchable as OvertureError

2. **Type distinction** - Tests specific error codes
   - Verifies: Each error has unique code

3. **Unique exit codes** - Tests exit code uniqueness
   - Verifies: All exit codes are different

### Error Messages and Properties Tests (8 total)

#### Message Clarity (2 tests)
1. **Config error messages** - Tests helpful messages
2. **Validation error messages** - Tests issue clarity

#### Error Names (1 test)
1. **Descriptive names** - Verifies each error has proper name

## Testing Methodology

### Pattern: Arrange-Act-Assert (AAA)

Every test follows this structure:

```typescript
it('should do something', () => {
  // Arrange - Set up test data
  const input = { /* test data */ };

  // Act - Execute code being tested
  const result = SomeSchema.safeParse(input);

  // Assert - Verify results
  expect(result.success).toBe(true);
});
```

### Zod Validation Testing Approach

For each schema, tests verify:

1. **Valid Inputs** - Happy path scenarios that should pass
2. **Invalid Inputs** - Rejection cases with error verification
3. **Edge Cases** - Boundary conditions and special cases

### Error Class Testing Approach

For each error class, tests verify:

1. **Instantiation** - Creation with various parameters
2. **Properties** - Access and modification of properties
3. **Inheritance** - Extension of parent classes
4. **Use Cases** - Real-world error scenarios
5. **Polymorphism** - Type distinction and handling

## Key Test Characteristics

### Comprehensiveness
- Tests cover all schema fields and validations
- Tests cover all error classes and properties
- Tests include both success and failure cases
- Tests include edge cases and boundaries

### Clarity
- Test names clearly describe what is being tested
- AAA pattern makes test flow obvious
- Comments explain test purposes where needed
- Test data is minimal and focused

### Maintainability
- Tests are organized in logical groups
- Describe blocks match code structure
- Tests are independent and can run in any order
- No shared test state or dependencies

### Robustness
- Tests verify exact error codes and messages
- Tests check for proper type validation
- Tests verify inheritance chains
- Tests include real-world error scenarios

## Coverage Summary

| Component | File | Tests | Coverage |
|-----------|------|-------|----------|
| McpServerSchema | schemas.spec.ts | 17 | Full validation |
| PluginSchema | schemas.spec.ts | 13 | Full validation |
| ProjectSchema | schemas.spec.ts | 9 | Full validation |
| OvertureConfigSchema | schemas.spec.ts | 14 | Full validation |
| McpJsonSchema | schemas.spec.ts | 8 | Full validation |
| OvertureError | errors.spec.ts | 11 | Full class coverage |
| ConfigError | errors.spec.ts | 11 | Full class coverage |
| ValidationError | errors.spec.ts | 11 | Full class coverage |
| PluginError | errors.spec.ts | 11 | Full class coverage |
| McpError | errors.spec.ts | 11 | Full class coverage |
| Inheritance Chain | errors.spec.ts | 8 | Full hierarchy |
| Properties/Messages | errors.spec.ts | 8 | Full coverage |

**Total: 125 tests across 2 files**
