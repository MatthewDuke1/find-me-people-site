#!/usr/bin/env sh
# Copy the extension's pure modules into the web app. Run from the site repo root
# with the extension checked out beside it: sh app/sync-lib.sh [../find-me-people]
set -e
SRC="${1:-../find-me-people}"
for f in ledger-store.js statement-parser.js merchant-table.js refund-templates.js \
         advocacy-letters.js escalation-registry.js chargeback-guide.js refund-deadline-engine.js; do
  cp "$SRC/$f" "app/lib/$f"
done
( cd "$SRC" && git rev-parse --short HEAD ) > app/lib/SOURCE_COMMIT
echo "synced from $SRC @ $(cat app/lib/SOURCE_COMMIT)"
