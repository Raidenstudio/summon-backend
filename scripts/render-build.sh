#!/bin/bash

set -e

# Install Rust if needed
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

export PATH="$HOME/.cargo/bin:$PATH"

# Update and install system dependencies (includes libclang)
apt-get update && apt-get install -y \
  git libssl-dev pkg-config clang cmake unzip build-essential \
  llvm-dev libclang-dev clang

# Clone Sui and build CLI from source (main branch)
git clone https://github.com/MystenLabs/sui.git
cd sui

echo "✅ Building Sui CLI from source..."
cargo build --release -p sui

# Move the built binary into PATH
cp target/release/sui $HOME/.cargo/bin/
chmod +x $HOME/.cargo/bin/sui
cd ..

# Confirm success
echo "✅ Installed Sui CLI version:"
sui --version

# Build your Move contract
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps
