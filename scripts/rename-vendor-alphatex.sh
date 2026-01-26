#!/usr/bin/env bash
set -euo pipefail

# Rename vendor-alphatex-* files in en/ and zh-cn/ by removing the prefix
# Usage: ./scripts/rename-vendor-alphatex.sh         (dry-run)
#        ./scripts/rename-vendor-alphatex.sh --apply  (perform changes)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIRS=("$ROOT_DIR/src/renderer/data/tutorials/en" "$ROOT_DIR/src/renderer/data/tutorials/zh-cn")
APPLY=false

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

echo "Scanning for files to rename (prefix: vendor-alphatex-)..."
renames=()
for d in "${DIRS[@]}"; do
  if [[ -d "$d" ]]; then
    while IFS= read -r -d $'\0' f; do
      base=$(basename "$f")
      newbase=${base#vendor-alphatex-}
      renames+=("$f::$d/$newbase")
    done < <(find "$d" -maxdepth 1 -type f -name 'vendor-alphatex-*.mdx' -print0)
  fi
done

if [[ ${#renames[@]} -eq 0 ]]; then
  echo "No files found to rename. Nothing to do." >&2
  exit 0
fi

echo "Planned renames:"
for r in "${renames[@]}"; do
  IFS='::' read -r src dst <<< "$r"
  echo "  $src -> $dst"
done

# detect places where the prefix appears in repo files
echo
echo "Searching for references to 'vendor-alphatex-' in src files..."
refs=$(git grep -n --full-name -I "vendor-alphatex-" -- src || true)
if [[ -n "$refs" ]]; then
  echo "Found references in the following files:" 
  echo "$refs"
else
  echo "No references found in tracked src files. (There may still be matches in JSON or docs.)"
fi

if [[ "$APPLY" != true ]]; then
  echo
  echo "Dry run complete. To apply changes, run:"
  echo "  $0 --apply"
  exit 0
fi

# Confirm before applying
read -rp "Apply the changes above? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted by user." >&2
  exit 1
fi

# Perform renames (use git mv if inside a git repo)
inside_git=false
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  inside_git=true
fi

for r in "${renames[@]}"; do
  IFS='::' read -r src dst <<< "$r"
  dst_dir=$(dirname "$dst")
  mkdir -p "$dst_dir"
  if [[ "$inside_git" == true ]]; then
    git mv "$src" "$dst"
  else
    mv "$src" "$dst"
  fi
  echo "Renamed: $src -> $dst"
done

# Replace id references in tutorials registry and index.ts and any source files
# We replace occurrences of vendor-alphatex-<slug> -> <slug>
# Use perl for cross-platform in-place edits

echo "Updating references in files..."
# files to update explicitly
perl -0777 -pe 's/"vendor-alphatex-([A-Za-z0-9_\-]+)"/"$1"/g' -i "$ROOT_DIR/src/renderer/data/tutorials/vendor-alphatex-registry.json"
perl -0777 -pe 's/id:\s*"vendor-alphatex-([A-Za-z0-9_\-]+)"/id: "$1"/g' -i "$ROOT_DIR/src/renderer/data/tutorials/index.ts"

# Update any other source files under src/ referencing vendor-alphatex-
# Only touch string-like occurrences to be conservative
while IFS= read -r -d $'\0' file; do
  echo "Patching: $file"
  perl -0777 -pe 's/vendor-alphatex-([A-Za-z0-9_\-]+)/$1/g' -i "$file"
done < <(git grep -lz --full-name -I "vendor-alphatex-" -- src || true)

# Stage changes if in git
if [[ "$inside_git" == true ]]; then
  git add -A
  echo "Changes staged. Please review and commit (or amend as needed)."
else
  echo "Changes applied (no git detected). Please review and commit the changes manually." 
fi

echo "Done. Recommendation: run 'pnpm format' and 'pnpm check' to ensure code style and type checks." 
