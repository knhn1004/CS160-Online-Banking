/**
 * Script to clear AsyncStorage from command line (for debugging)
 * Usage: node scripts/clear-storage.js
 */

const { execSync } = require("child_process");

console.log("🔄 Clearing app storage...");

try {
  // For Expo Go, we need to use the Expo CLI
  // For development builds, we can use adb (Android) or simctl (iOS)
  
  console.log("💡 To clear storage:");
  console.log("   1. In Expo Go: Shake device > Reload (or press 'r' in terminal)");
  console.log("   2. In iOS Simulator: Run './reset-simulator.sh'");
  console.log("   3. In Android: adb shell pm clear host.exp.exponent");
  console.log("");
  console.log("   Or uninstall/reinstall the app to clear all data");
  
  // Try to get the bundle ID
  try {
    const appJson = require("../app.json");
    const bundleId = appJson.expo?.ios?.bundleIdentifier || "host.exp.Exponent";
    console.log(`📦 Bundle ID: ${bundleId}`);
  } catch (e) {
    // Ignore
  }
  
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}


