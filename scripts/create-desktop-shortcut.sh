#!/usr/bin/env bash
set -euo pipefail
DESKTOP_FILE="$HOME/Desktop/43Zekat.desktop"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cat > "$DESKTOP_FILE" <<EOL
[Desktop Entry]
Version=1.0
Type=Application
Name=43Zekat
Comment=Run 43Zekat PWA
Exec=bash -lc 'cd "$PROJECT_DIR" && npm run dev:safe'
Icon=$PROJECT_DIR/public/icon-192.svg
Terminal=true
Categories=Utility;
EOL
chmod +x "$DESKTOP_FILE"
echo "Desktop shortcut created at $DESKTOP_FILE"
