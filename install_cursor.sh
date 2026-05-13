#!/bin/bash
# distributivize skill installer

set -e

REPO="https://github.com/exergy-connect/Distributivize.ai.git"
SKILLS=("skills/distributivize")
TARGET="$HOME/.cursor/skills"
VERSION_URL="https://exergy-connect.github.io/distributivize/latest"

# --check flag: compare versions only
if [ "$1" = "--check" ]; then
  LATEST=$(curl -fsSL "$VERSION_URL")
  LOCAL=$(cat "$TARGET/.distributivize-latest" 2>/dev/null || echo "not installed")
  echo "Installed: $LOCAL — Latest: $LATEST"
  [ "$LOCAL" = "$LATEST" ] && echo "Up to date." || echo "Update available. Re-run without --check to install."
  exit 0
fi

TMP=$(mktemp -d)

git clone --filter=blob:none --sparse "$REPO" "$TMP"

cd "$TMP"

git sparse-checkout set "${SKILLS[@]}"

mkdir -p "$TARGET"

for SKILL in "${SKILLS[@]}"; do
  SKILL_NAME=$(basename "$SKILL")

  rm -rf "$TARGET/$SKILL_NAME"

  cp -r "$SKILL" "$TARGET/$SKILL_NAME"

  echo "Installed: $SKILL_NAME"
done

# Record installed version
SUITE_VERSION=$(curl -fsSL "$VERSION_URL")

echo "$SUITE_VERSION" > "$TARGET/.distributivize-latest"

rm -rf "$TMP"

echo "distributivize v$SUITE_VERSION installed."
