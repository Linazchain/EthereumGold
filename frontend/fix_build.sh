#!/bin/sh
set -e

echo "🛠️ 1. Installing Python 3 and C++ build dependencies in Alpine..."
apk add python3 make g++ build-base

cd ~/ethereumgold/frontend

echo "📦 2. Re-installing dependencies with build tools available..."
npm install

echo "🚀 3. Starting Next.js dev server..."
npm run dev
