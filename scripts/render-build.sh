#!/bin/bash

set -e

# Install Rust
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

export PATH="$HOME/.cargo/bin:$PATH"

# Install required native packages
apt-get update && apt-get install -y \
  git libssl-dev pkg-config clang cmake unzip build-essential \
  llvm-dev libclang-dev clang

# Fix for bindgen — set libclang path
export LIBCLANG_PATH="/usr/lib/llvm-14/lib"

# Clone Sui CLI
git clone https://github.com/MystenLabs/sui.git
cd sui

echo "✅ Building Sui CLI from source..."
cargo build --release -p sui

# Add to PATH
cp target/release/sui $HOME/.cargo/bin/
chmod +x $HOME/.cargo/bin/sui
cd ..

# Confirm version
sui --version

# Build your Move contract
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps
