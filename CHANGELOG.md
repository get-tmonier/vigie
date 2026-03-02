# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `tmonier login` command with browser-based OAuth flow and `--token` manual login
- `tmonier logout` command to clear saved credentials
- Credential storage in `~/.tmonier/credentials.json` with restrictive file permissions (0600)
- `TMONIER_TOKEN` env var support as alternative to stored credentials
- `TMONIER_APP_URL` config for auth redirect target
- WebSocket authentication via `daemon:hello` token field and query parameter on upgrade
- Tests for credentials I/O, login callback (CSRF/XSS), config defaults, and WebSocket handshake

### Fixed

- Login callback server now binds to `127.0.0.1` instead of all interfaces

### Changed

- Initial project scaffolding (Bun, Biome, TypeScript strict, ESM only)
- Build pipeline: `bun run verify` (knip, biome check, typecheck, test, build)
- Standalone binary compilation via `bun build --compile`
- WebSocket client with auto-reconnect for daemon ↔ backend communication
- Process executor for spawning and streaming child process output
- Valibot message schemas for downstream and upstream message contracts
