#!/bin/bash

set -e  # Stop on error

# Install Rust if not already installed
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

# Ensure cargo bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Manually install Sui CLI (latest release)
SUI_VERSION="0.36.1"  # Replace with latest if needed
SUI_URL="https://github.com/MystenLabs/sui/releases/download/${SUI_VERSION}/sui-${SUI_VERSION}-ubuntu-x86_64.tar.gz"

echo "Downloading Sui CLI $SUI_VERSION..."
curl -L $SUI_URL -o sui.tar.gz
mkdir -p sui-cli
tar -xzf sui.tar.gz -C sui-cli
mv sui-cli/sui-${SUI_VERSION}-ubuntu-x86_64/sui $HOME/.cargo/bin/

# Confirm it's working
echo "Sui CLI version:"
sui --version

# Build the Move contract
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps
