#!/bin/sh
set -e

SRC="src/modules/session/adapters/pty/native/vigie_pty.c"
OUT_DIR="dist"
mkdir -p "$OUT_DIR"

OS=$(uname -s)

NATIVE_DIR="src/modules/session/adapters/pty/native"

if [ "$OS" = "Darwin" ]; then
  cc -shared -o "$OUT_DIR/libvigie_pty.dylib" "$SRC" -lutil -lpthread
  cp "$OUT_DIR/libvigie_pty.dylib" "$NATIVE_DIR/libvigie_pty.dylib"
elif [ "$OS" = "Linux" ]; then
  cc -shared -fPIC -o "$OUT_DIR/libvigie_pty.so" "$SRC" -lutil -lpthread
  cp "$OUT_DIR/libvigie_pty.so" "$NATIVE_DIR/libvigie_pty.so"
else
  echo "Unsupported OS: $OS" >&2
  exit 1
fi

echo "Built PTY native library for $OS"
