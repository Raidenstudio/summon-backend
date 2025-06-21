# 1. Use Rust as the base image
FROM rust:1.87

# 2. Install system dependencies
RUN apt-get update && apt-get install -y \
  libssl-dev pkg-config clang cmake unzip build-essential \
  llvm-dev libclang-dev git curl

# 3. Fix for bindgen + Sui CLI
ENV LIBCLANG_PATH=/usr/lib/llvm-14/lib
ENV PATH="/root/.cargo/bin:$PATH"

# 4. Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# 5. Set working directory
WORKDIR /app

# 6. Copy all project files to the container
COPY . .

# 7. Build Sui CLI from source
RUN git clone https://github.com/MystenLabs/sui.git && \
    cd sui && \
    cargo build --release -p sui && \
    cp target/release/sui /usr/local/bin && \
    cd ..

# 8. Build your Move project
RUN cd meme_launchpad && sui move build --skip-fetch-latest-git-deps

# 9. Install backend dependencies (Bun)
RUN /root/.bun/bin/bun install

# 10. Run your backend server
CMD ["/root/.bun/bin/bun", "start"]
