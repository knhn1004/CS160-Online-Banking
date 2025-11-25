#!/bin/bash
# Script to reset Expo simulator to clean state

echo "🔄 Resetting Expo simulator..."

# Get the bundle identifier from app.json
BUNDLE_ID=$(grep -A 5 '"ios"' app.json | grep -o '"bundleIdentifier": "[^"]*"' | cut -d'"' -f4)

if [ -z "$BUNDLE_ID" ]; then
  # Try to get it from expo config
  BUNDLE_ID=$(npx expo config --type public | grep -o '"iosBundleIdentifier": "[^"]*"' | cut -d'"' -f4 || echo "")
fi

if [ -z "$BUNDLE_ID" ]; then
  echo "⚠️  Could not find bundle identifier, using default..."
  BUNDLE_ID="host.exp.Exponent"
fi

echo "📦 Bundle ID: $BUNDLE_ID"

# Option 1: Uninstall the app (clears all app data)
echo "🗑️  Uninstalling app..."
xcrun simctl uninstall booted "$BUNDLE_ID" 2>/dev/null || echo "   App not installed or already removed"

# Option 2: Clear all simulator data (more aggressive)
if [ "$1" == "--full" ]; then
  echo "🧹 Performing full simulator reset..."
  xcrun simctl erase all
  echo "✅ Simulator fully reset"
else
  echo "✅ App data cleared"
  echo ""
  echo "💡 To fully reset the simulator, run: ./reset-simulator.sh --full"
fi

echo ""
echo "🚀 Restart Expo with: pnpm ios"
