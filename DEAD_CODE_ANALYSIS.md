# Dead Code Analysis - Overture Repository

## Summary

This analysis identifies code that can be safely removed from the Overture codebase.

## 🔴 High Priority - Can Remove Immediately

### 1. Unused Template System (TemplateLoader)
**Location:** `libs/adapters/infrastructure/src/lib/template-loader.ts`

**Why Remove:**
- No templates directory exists (`libs/adapters/infrastructure/src/assets/templates/` not found)
- Not imported or used anywhere in the codebase
- Adds unnecessary dependency on `handlebars`

**Files to Remove:**
```bash
rm libs/adapters/infrastructure/src/lib/template-loader.ts
rm libs/adapters/infrastructure/src/lib/template-loader.spec.ts  # if exists
```

**Update:** Remove from `libs/adapters/infrastructure/src/index.ts`:
```typescript
// DELETE THIS LINE:
export { TemplateLoader } from './lib/template-loader.js';
```

**Dependency Cleanup:**
```bash
npm uninstall handlebars  # After removal
```

---

### 2. Unused Utility Class (FsUtils)
**Location:** `libs/adapters/infrastructure/src/lib/fs-utils.ts`

**Why Remove:**
- Only used internally by TemplateLoader (which should be removed)
- All functionality replaced by NodeFilesystemAdapter (port-based architecture)
- Comment in index.ts says "TODO: Phase out in favor of port-based architecture"

**Files to Remove:**
```bash
rm libs/adapters/infrastructure/src/lib/fs-utils.ts
rm libs/adapters/infrastructure/src/lib/fs-utils.spec.ts  # if exists
```

**Update:** Remove from `libs/adapters/infrastructure/src/index.ts`:
```typescript
// DELETE THIS LINE:
export { FsUtils } from './lib/fs-utils.js';
```

---

## 🟡 Medium Priority - Consider Removing

### 3. Deprecated Method (getLegacyUserConfigPath)
**Location:** `libs/core/config/src/lib/path-resolver.ts:173`

**Current Usage:** Only 1 usage in `config-loader.ts` for backward compatibility

**Why Consider Removing:**
- Marked `@deprecated` 
- Only used for fallback to old config location
- Users have had time to migrate (v0.3.0)

**Recommendation:** 
Remove in v1.0.0 with migration guide. Keep for now for backward compatibility.

---

## 🟢 Low Priority - Keep for Now

### 4. Test Setup File
**Location:** `apps/cli-e2e/src/test-setup.ts`

**Status:** No exports, but may be used by Vitest config

**Recommendation:** Keep - test configuration files don't need exports

---

## Impact Analysis

### Lines of Code Reduction
- TemplateLoader: ~70 lines
- FsUtils: ~80 lines
- **Total:** ~150 lines removed

### Dependency Reduction
- Can remove `handlebars` from package.json (~200KB)

### Build Time Impact
- Slightly faster builds (fewer files to process)
- Reduced bundle size

---

## Implementation Plan

### Phase 1: Remove Unused Code (Safe - No Breaking Changes)
1. Delete TemplateLoader
2. Delete FsUtils
3. Update infrastructure index.ts
4. Remove handlebars dependency
5. Run tests to verify
6. Update TODO comment in index.ts

### Phase 2: Remove Deprecated Code (Breaking Change - v1.0.0)
1. Remove getLegacyUserConfigPath()
2. Remove fallback logic in config-loader.ts
3. Document migration in CHANGELOG
4. Bump to v1.0.0

---

## Testing Before Removal

```bash
# 1. Check no imports of these utilities
grep -r "TemplateLoader\|FsUtils" --include="*.ts" . | grep -v node_modules | grep -v infrastructure/src

# 2. Run all tests
nx test @overture/cli

# 3. Build all projects
nx build @overture/cli

# 4. Check for missing dependencies
npm ls handlebars
```

---

## Estimated Savings

| Item | LOC Removed | Deps Removed | Files Removed |
|------|-------------|--------------|---------------|
| TemplateLoader | ~70 | handlebars | 1-2 |
| FsUtils | ~80 | - | 1-2 |
| **Total** | **~150** | **1 package** | **2-4 files** |
