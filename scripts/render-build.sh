#!/bin/bash

set -e  # Stop on error

# Install Rust if not already installed
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

# Ensure cargo bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Download Sui CLI prebuilt binary manually
SUI_VERSION="0.36.1"
SUI_ASSET="sui-${SUI_VERSION}-ubuntu-x86_64.tar.gz"
SUI_URL="https://github.com/MystenLabs/sui/releases/download/${SUI_VERSION}/${SUI_ASSET}"

echo "Downloading Sui CLI $SUI_VERSION..."
curl -L -o sui.tar.gz "$SUI_URL"

# Extract and move binary to ~/.cargo/bin
mkdir -p sui-cli
tar -xzf sui.tar.gz -C sui-cli
mv sui-cli/sui-${SUI_VERSION}-ubuntu-x86_64/sui $HOME/.cargo/bin/

# Ensure it's executable
chmod +x $HOME/.cargo/bin/sui

# Verify Sui CLI is installed
echo "Sui CLI version:"
sui --version

# Navigate to Move package directory
cd meme_launchpad

# Build the Move contract
sui move build --skip-fetch-latest-git-deps
