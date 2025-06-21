#!/bin/bash

set -e

# Install Rust
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

export PATH="$HOME/.cargo/bin:$PATH"

# Install dependencies
apt-get update && apt-get install -y \
  git libssl-dev pkg-config clang cmake unzip build-essential \
  llvm-dev libclang-dev clang

# Set correct LIBCLANG_PATH
LIBCLANG_SO=$(find /usr/lib/llvm-* -name "libclang.so" | head -n 1)
if [ -z "$LIBCLANG_SO" ]; then
  echo "❌ libclang.so not found — install failed or wrong path."
  exit 1
fi

export LIBCLANG_PATH=$(dirname "$LIBCLANG_SO")
echo "✅ LIBCLANG_PATH set to: $LIBCLANG_PATH"

# Clone Sui and build
git clone https://github.com/MystenLabs/sui.git
cd sui
cargo build --release -p sui

# Move built binary
cp target/release/sui $HOME/.cargo/bin/
chmod +x $HOME/.cargo/bin/sui
cd ..

# Confirm
sui --version

# Build your Move contract
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps
