#!/bin/bash
# Generates js/config.js from Netlify environment variables.
# Set SUPABASE_URL and SUPABASE_ANON_KEY in:
#   Netlify Dashboard → Site configuration → Environment variables

set -e

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set as environment variables."
  exit 1
fi

cat > js/config.js << EOF
// Auto-generated at build time from Netlify environment variables.
// Do not edit manually.
const SUPABASE_CONFIG = {
  url:     '${SUPABASE_URL}',
  anonKey: '${SUPABASE_ANON_KEY}',
};
EOF

echo "✓ js/config.js generated"
