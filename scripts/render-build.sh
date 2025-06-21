#!/bin/bash

set -e

# Install Rust
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

# Ensure cargo bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# -----------------------------
# Install unzip (Render default doesn't include it)
# -----------------------------
if ! command -v unzip &> /dev/null; then
  apt-get update && apt-get install -y unzip
fi

# -----------------------------
# Download and install Sui CLI v1.51.0 (.zip)
# -----------------------------
SUI_VERSION="1.51.0"
ZIP_URL="https://github.com/MystenLabs/sui/releases/download/${SUI_VERSION}/sui-${SUI_VERSION}-ubuntu-x86_64.zip"

echo "✅ Downloading Sui CLI $SUI_VERSION"
curl -L "$ZIP_URL" -o sui.zip

unzip sui.zip -d sui-cli
SUI_BINARY=$(find sui-cli -type f -name sui | head -n 1)

if [ ! -f "$SUI_BINARY" ]; then
  echo "❌ Sui binary not found after unzip"
  exit 1
fi

mv "$SUI_BINARY" "$HOME/.cargo/bin/"
chmod +x "$HOME/.cargo/bin/sui"

# Confirm version
echo "✅ Installed Sui CLI version:"
sui --version

# -----------------------------
# Build the Move contract
# -----------------------------
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps