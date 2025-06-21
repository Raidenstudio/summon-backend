#!/bin/bash

set -e  # Stop on error

# Install Rust if not already installed
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

# Ensure cargo bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# --------------------------
# DOWNLOAD AND INSTALL SUI
# --------------------------

# Pick a Sui release version
SUI_VERSION="0.36.1"

# Download release asset metadata from GitHub API
ASSET_URL=$(curl -s "https://api.github.com/repos/MystenLabs/sui/releases/tags/${SUI_VERSION}" | \
  grep "browser_download_url" | \
  grep "ubuntu-x86_64.tar.gz" | \
  cut -d '"' -f 4)

if [ -z "$ASSET_URL" ]; then
  echo "❌ Failed to find a valid .tar.gz for Sui CLI version $SUI_VERSION"
  exit 1
fi

echo "✅ Downloading Sui CLI from: $ASSET_URL"
curl -L "$ASSET_URL" -o sui.tar.gz

# Extract and move binary to ~/.cargo/bin
mkdir -p sui-cli
tar -xzf sui.tar.gz -C sui-cli
SUI_BINARY=$(find sui-cli -type f -name sui | head -n 1)

if [ ! -f "$SUI_BINARY" ]; then
  echo "❌ Sui binary not found after extraction"
  exit 1
fi

mv "$SUI_BINARY" $HOME/.cargo/bin/
chmod +x $HOME/.cargo/bin/sui

# Check version
echo "✅ Installed Sui CLI version:"
sui --version

# --------------------------
# BUILD MOVE CONTRACT
# --------------------------

cd meme_launchpad
sui move build --skip-fetch-latest-git-deps