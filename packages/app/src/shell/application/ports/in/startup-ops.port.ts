export interface StartupOpsShape {
  cleanupOrphanedSessions(): void;
  pruneOldSessions(): void;
  checkResumableForAll(): void;
  checkResumableForActive(): void;
}
