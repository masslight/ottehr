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
