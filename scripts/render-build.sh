#!/bin/bash

set -e  # Stop on error

# Install Rust (only if not already installed)
if ! command -v rustc &> /dev/null
then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

# Install Sui CLI to ~/.cargo/bin
curl -s https://install.sui.io | sh

# Ensure ~/.cargo/bin is in the PATH so we can use `sui` command
export PATH="$HOME/.cargo/bin:$PATH"

# Verify sui command is available
echo "Sui CLI version:"
sui --version

# Navigate to your Move package directory
cd meme_launchpad

# Build the Move contract
sui move build --skip-fetch-latest-git-deps
