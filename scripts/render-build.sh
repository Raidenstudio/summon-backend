#!/bin/bash

set -e  # Stop script on error

# Install Rust
curl https://sh.rustup.rs -sSf | sh -s -- -y
source $HOME/.cargo/env

# Install Sui CLI
curl -s https://install.sui.io | sh
source $HOME/.sui/env

# Navigate to the Move package directory
cd meme_launchpad

# Build the Move contract
sui move build --skip-fetch-latest-git-deps
