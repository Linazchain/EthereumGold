#!/bin/sh
set -e

echo "🛑 1. Stopping any lingering Node processes..."
pkill -9 -f node 2>/dev/null || true
pkill -9 -f next 2>/dev/null || true

cd ~/ethereumgold/frontend

echo "⚡ 2. Instant cleanup using Node native filesystem API..."
node -e "
const fs = require('fs');
['node_modules', 'package-lock.json', '.next'].forEach(target => {
  if (fs.existsSync(target)) {
    console.log('  -> Removing ' + target + '...');
    fs.rmSync(target, { recursive: true, force: true });
  }
});
"

echo "📦 3. Installing fresh dependencies..."
npm install --no-audit --no-fund

echo "🚀 4. Launching Next.js development server..."
npm run dev
