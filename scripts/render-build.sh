#!/bin/bash

set -e

# Install Rust if not installed
if ! command -v rustc &> /dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  source $HOME/.cargo/env
fi

export PATH="$HOME/.cargo/bin:$PATH"

# Install tools needed to build Sui
apt-get update && apt-get install -y git libssl-dev pkg-config clang cmake unzip build-essential

# Clone the Sui repo and build from main (latest devnet)
git clone https://github.com/MystenLabs/sui.git
cd sui

echo "✅ Building Sui CLI from source (main branch)..."
cargo build --release -p sui

# Move to usable path
cp target/release/sui $HOME/.cargo/bin/
chmod +x $HOME/.cargo/bin/sui
cd ..

# Check version
echo "✅ Installed Sui CLI version:"
sui --version

# Build Move package
cd meme_launchpad
sui move build --skip-fetch-latest-git-deps