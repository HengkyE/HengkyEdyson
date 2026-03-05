#!/bin/bash

# Script to set up Supabase environment variables for EAS builds
# This will configure your APK builds to connect to Supabase

echo "🔐 Setting up Supabase Environment Variables for EAS Builds"
echo ""

# Check if logged in
if ! npx eas-cli@latest whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Expo"
    echo ""
    echo "Please login first:"
    echo "   npx eas-cli@latest login"
    exit 1
fi

echo "✅ Logged in to Expo"
echo ""

# Get values from user
echo "Enter your Supabase credentials:"
echo ""

read -p "Supabase URL (e.g., https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_KEY

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Both values are required!"
    exit 1
fi

echo ""
echo "📝 Setting environment variables..."

# Set for preview environment
echo "Setting for preview environment..."
npx eas-cli@latest env:create \
  --name EXPO_PUBLIC_SUPABASE_URL \
  --value "$SUPABASE_URL" \
  --type string \
  --scope project \
  --environment preview \
  --non-interactive

npx eas-cli@latest env:create \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "$SUPABASE_KEY" \
  --type string \
  --scope project \
  --environment preview \
  --non-interactive

# Ask if they want to set for production too
read -p "Set for production environment as well? (y/n): " SET_PRODUCTION

if [ "$SET_PRODUCTION" = "y" ] || [ "$SET_PRODUCTION" = "Y" ]; then
    echo "Setting for production environment..."
    npx eas-cli@latest env:create \
      --name EXPO_PUBLIC_SUPABASE_URL \
      --value "$SUPABASE_URL" \
      --type string \
      --scope project \
      --environment production \
      --non-interactive

    npx eas-cli@latest env:create \
      --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
      --value "$SUPABASE_KEY" \
      --type string \
      --scope project \
      --environment production \
      --non-interactive
fi

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "📋 Verify with:"
echo "   npx eas-cli@latest env:list"
echo ""
echo "🔨 Rebuild your APK:"
echo "   npx eas-cli@latest build --platform android --profile preview"
echo ""
