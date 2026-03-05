#!/bin/bash

# Android APK Build Script for EdysonPOS
# This script will build an Android APK using EAS Build

echo "🚀 Starting Android APK Build Process..."
echo ""

# Check if logged in
echo "📋 Checking Expo login status..."
if npx eas-cli@latest whoami > /dev/null 2>&1; then
    echo "✅ Logged in to Expo"
    EXPO_USER=$(npx eas-cli@latest whoami)
    echo "   Account: $EXPO_USER"
else
    echo "❌ Not logged in to Expo"
    echo ""
    echo "Please login first:"
    echo "   npx eas-cli@latest login"
    echo ""
    echo "Or create an account at: https://expo.dev/signup"
    exit 1
fi

echo ""
echo "🔨 Starting build..."
echo "   Platform: Android"
echo "   Profile: Preview (APK for testing)"
echo ""

# Start the build
npx eas-cli@latest build --platform android --profile preview

echo ""
echo "✅ Build process started!"
echo ""
echo "📱 Where to find your APK:"
echo "   1. Check the terminal output above for download URL"
echo "   2. Or visit: https://expo.dev/accounts/$EXPO_USER/projects/EdysonPOS/builds"
echo "   3. Wait for build to complete (usually 10-20 minutes)"
echo "   4. Download the APK from the build page"
echo ""
echo "💡 To check build status:"
echo "   npx eas-cli@latest build:list"
echo ""
