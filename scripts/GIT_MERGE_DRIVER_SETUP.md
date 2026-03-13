# Git Merge Driver Setup for package.json and package-lock.json

This merge driver automatically resolves version conflicts in `package.json` and `package-lock.json`, always selecting the greater version.

## Installation

### Automatic Installation (Recommended)

Simply run the setup script:

```bash
./scripts/setup-git-merge-driver.sh
```

This script will automatically configure the merge driver for the current repository.

### Manual Installation

#### 1. Configure git config (locally for repository)

```bash
git config merge.package-version.driver 'node scripts/git-merge-driver-package-version.js %O %A %B'
```

#### 2. Configure git config (globally for all repositories)

```bash
git config --global merge.package-version.driver 'node <absolute-path>/scripts/git-merge-driver-package-version.js %O %A %B'
```

**Note:** For global configuration, use an absolute path to the script.

#### 3. .gitattributes file

The `.gitattributes` file is already configured in the repository root and tells git to use this merge driver for all `package.json` and `package-lock.json` files.

## How It Works

1. When a merge conflict occurs in `package.json` or `package-lock.json`, git automatically calls the `git-merge-driver-package-version.js` script
2. The script finds all version conflicts in the format `"version": "X.Y.Z"`
3. Compares versions and selects the greater one
4. Automatically resolves the conflict

## Example

If a merge conflict occurs:
```
<<<<<<< HEAD
  "version": "1.22.23",
=======
  "version": "1.22.24",
>>>>>>> upstream/release/1.22
```

The merge driver will automatically select `1.22.24` (the greater version) and resolve the conflict.

## Verification

To verify that the merge driver is configured correctly:

```bash
git config --get merge.package-version.driver
```

Should output:
```
node scripts/git-merge-driver-package-version.js %O %A %B
```

## Disabling

If you need to temporarily disable automatic conflict resolution:

```bash
git config --unset merge.package-version.driver
```

Or remove the lines from `.gitattributes`:
```
# package.json merge=package-version
# package-lock.json merge=package-version
```

## Seed Data Merge Driver (for Downstream Repositories)

The repository also includes an "ours" merge driver for seed data files in `apps/ehr/tests/e2e-utils/seed-data/resources/`. This keeps the downstream version of seed data files during merges from upstream.

### How It Works

1. `.gitattributes` specifies `merge=ours` for seed data JSON files
2. The `merge.ours.driver=true` config uses the `true` command, which always exits successfully without modifying the file
3. When downstream merges from upstream, their customized seed data remains untouched

### Manual Setup

If you need to configure this manually:

```bash
git config merge.ours.driver true
```

## Config Directory Merge Driver

All files in the `config/` directory use the "ours" merge strategy, which always keeps the current branch version during merges, even when there are no conflicts.

### How It Works

1. `.gitattributes` specifies `merge=ours` for all files under `config/**`
2. The `merge.ours.driver=true` config ensures the current branch version is always used
3. During merges, incoming changes to config files are ignored and the current branch version is preserved

### Use Case

This is useful when:
- Configuration files in the current branch should never be overwritten by incoming changes
- You want to maintain branch-specific configuration without manual merge conflict resolution
- Configuration files should remain stable during merges from other branches

### Manual Setup

The setup script automatically configures this, but you can also configure manually:

```bash
git config merge.ours.driver true
```

### When to Regenerate Seed Data

Downstream repositories should regenerate their seed data at appropriate times, such as:
- After pulling upstream changes that affect test infrastructure
- After updating questionnaires or other FHIR resources that seed data depends on
- When test data contracts change
