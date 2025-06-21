#!/bin/bash

set -e  # Stop on any error

# Install Rust if not already installed
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

# Ensure cargo bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# -----------------------------
# DOWNLOAD & INSTALL SUI 1.51.0
# -----------------------------
SUI_VERSION="1.51.0"
ASSET_URL="https://github.com/MystenLabs/sui/releases/download/${SUI_VERSION}/sui-${SUI_VERSION}-ubuntu-x86_64.tar.gz"

echo "✅ Downloading Sui CLI $SUI_VERSION"
curl -L "$ASSET_URL" -o sui.tar.gz

mkdir -p sui-cli
tar -xzf sui.tar.gz -C sui-cli
SUI_BINARY=$(find sui-cli -type f -name sui | head -n 1)

if [ ! -f "$SUI_BINARY" ]; then
  echo "❌ Sui binary not found after extraction"
  exit 1
fi

mv "$SUI_BINARY" $HOME/.cargo/bin/
chmod +x $HOME/.cargo/bin/sui

# Confirm it works
echo "✅ Installed Sui CLI version:"
sui --version

# -----------------------------
# BUILD YOUR MOVE CONTRACT
# -----------------------------
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps