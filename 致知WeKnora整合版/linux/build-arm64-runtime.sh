#!/bin/bash
# Run in the Ubuntu 20.04 ARM64 build container, with the project at /workspace.
set -euo pipefail
test "$(uname -m)" = aarch64
cd /build
assets=/workspace/.build-tools/kylin-arm64
echo 'bd03b743eb6eb4193ea3c3fd3956546bf0e3ca5b7076c8226334afe6b75704cd  /workspace/.build-tools/kylin-arm64/go.tar.gz' | sha256sum -c -
echo '9120e0a653868f6e3698d36cdd99e5a58903ec9469e448f21d98f7b16d8fa290  /workspace/.build-tools/kylin-arm64/python.tar.xz' | sha256sum -c -
echo '544ade6dc6bc15b4ffe0f9179863a92983f0c300b8c7d5cb774eddabbd542e50  /workspace/.build-tools/kylin-arm64/llama.tar.gz' | sha256sum -c -
echo '7d6a034b7fabdbf00c54a01e59a5eaeadb38a87c14f2d1d1156d7dcf0fb3a043  /workspace/.build-tools/kylin-arm64/libstdcxx.deb' | sha256sum -c -
echo 'fd0d60d0ec0406411fede4fba097b2c179bb5a20346730a9002b8eb7cecc8516  /workspace/.build-tools/kylin-arm64/gcc-runtime-notices.deb' | sha256sum -c -
test -x go/bin/go || tar -xzf "$assets/go.tar.gz"
test -d Python-3.11.18 || tar -xJf "$assets/python.tar.xz"
test -d llama.cpp-4577932fa || tar -xzf "$assets/llama.tar.gz"
export PATH=/build/go/bin:$PATH
export GOPATH=/workspace/.build-tools/gopath GOCACHE=/build/go-cache
export GOPROXY=https://goproxy.cn,direct GOMAXPROCS=2 GOMEMLIMIT=1800MiB

if [ ! -x /build/python/bin/python3.11 ]; then
    cd /build/Python-3.11.18
    ./configure --prefix=/build/python --without-ensurepip
    make -j2
    make install
fi
cd /build/llama.cpp-4577932fa
if [ ! -x /build/cmake-tools/cmake/data/bin/cmake ]; then
    /build/python/bin/python3.11 -m ensurepip
    /build/python/bin/python3.11 -m pip install --target /build/cmake-tools cmake==3.31.6
fi
export PATH=/build/cmake-tools/cmake/data/bin:$PATH
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF \
    -DGGML_CPU_ARM_ARCH=armv8-a -DGGML_OPENMP=OFF -DLLAMA_CURL=OFF \
    -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON \
    -DLLAMA_BUILD_APP=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
    -DLLAMA_BUILD_NUMBER=12503 -DLLAMA_BUILD_COMMIT=4577932fa
cmake --build build --target llama-server -j2

cd /workspace
python3 linux/prepare-wails.py
cp WeKnora/go.mod /build/kylin-go.mod
cp WeKnora/go.sum /build/kylin-go.sum
go -C WeKnora mod edit -modfile=/build/kylin-go.mod -replace=github.com/wailsapp/wails/v2=/build/wails-v2.12.0
export GOFLAGS=-modfile=/build/kylin-go.mod
mkdir -p /build/cxx
dpkg-deb -x "$assets/libstdcxx.deb" /build/cxx
dpkg-deb -x "$assets/gcc-runtime-notices.deb" /build/cxx
ln -sf libstdc++.so.6 /build/cxx/usr/lib/aarch64-linux-gnu/libstdc++.so
export CGO_LDFLAGS='-L/build/cxx/usr/lib/aarch64-linux-gnu -Wl,-rpath,/build/cxx/usr/lib/aarch64-linux-gnu'
GO=/build/go/bin/go /build/python/bin/python3.11 build.py linux-arm64
mkdir -p "$assets/runtime" "$assets/python"
cp -a /build/python/. "$assets/python/"
cp /build/llama.cpp-4577932fa/build/bin/llama-server "$assets/runtime/"
cp -a /build/llama.cpp-4577932fa/build/bin/*.so* "$assets/runtime/"
cp /build/llama.cpp-4577932fa/LICENSE "$assets/runtime/LICENSE-llama.cpp"
cp /build/Python-3.11.18/LICENSE "$assets/python/LICENSE-Python"
ldd /workspace/.build-tools/zhizhi-linux-arm64
"$assets/runtime/llama-server" --version
"$assets/python/bin/python3.11" -c 'import sqlite3, ssl, bz2, lzma; print("Python runtime ready")'
