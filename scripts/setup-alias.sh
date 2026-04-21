#!/bin/bash
# Script to add mytoken alias to ~/.zshrc

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI_SCRIPT="$PROJECT_DIR/scripts/cli.sh"

if ! grep -q "alias mytoken=" ~/.zshrc 2>/dev/null; then
  echo "" >> ~/.zshrc
  echo "# my-tokscale CLI alias" >> ~/.zshrc
  echo "alias mytoken='$CLI_SCRIPT'" >> ~/.zshrc
  echo "✅ Alias 'mytoken' added to ~/.zshrc"
else
  echo "⚠️  Alias 'mytoken' already exists in ~/.zshrc"
fi

echo "Run 'source ~/.zshrc' to apply the changes."
