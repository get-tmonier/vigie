# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

- Initial project scaffolding (Bun, Biome, TypeScript strict, ESM only)
- Build pipeline: `bun run verify` (knip, biome check, typecheck, test, build)
- Standalone binary compilation via `bun build --compile`
- WebSocket client with auto-reconnect for daemon ↔ backend communication
- Process executor for spawning and streaming child process output
- Valibot message schemas for downstream and upstream message contracts
