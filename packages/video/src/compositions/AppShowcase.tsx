import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { Caption } from '../components/Caption';
import { FadeIn } from '../components/FadeIn';
import { RadarBg } from '../components/RadarBg';
import { TerminalFrame } from '../components/TerminalFrame';
import { TypedText } from '../components/TypedText';
import { VigieSidebar } from '../components/VigieSidebar';
import { WebSocketLine } from '../components/WebSocketLine';
import { colors, fonts } from '../components/theme';

// ─── TIMING (frames at 30fps) ────────────────────────────────────
// ~2 min total (3600 frames). Each scene gets proper breathing room.
const S = {
  intro:        [0,    120],      // 4s
  login:        [100,  270],      // 5.7s
  daemon:       [250,  530],      // 9.3s
  agentWork:    [510,  810],      // 10s
  loopDetect:   [790,  1100],     // 10.3s
  scopeDrift:   [1080, 1340],     // 8.7s
  contextCost:  [1320, 1620],     // 10s
  checkpoint:   [1600, 1900],     // 10s
  termAttach:   [1880, 2200],     // 10.7s
  pairProg:     [2180, 2560],     // 12.7s
  history:      [2540, 2780],     // 8s
  killResume:   [2760, 3040],     // 9.3s
  outro:        [3020, 3600],     // 19.3s
} as const;

export const AppShowcase: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.navy900 }}>
      <RadarBg opacity={0.025} />

      <Seq t={S.intro}><IntroScene /></Seq>
      <Seq t={S.login}><LoginScene /></Seq>
      <Seq t={S.daemon}><DaemonScene /></Seq>
      <Seq t={S.agentWork}><AgentWorkScene /></Seq>
      <Seq t={S.loopDetect}><LoopDetectScene /></Seq>
      <Seq t={S.scopeDrift}><ScopeDriftScene /></Seq>
      <Seq t={S.contextCost}><ContextCostScene /></Seq>
      <Seq t={S.checkpoint}><CheckpointScene /></Seq>
      <Seq t={S.termAttach}><TerminalAttachScene /></Seq>
      <Seq t={S.pairProg}><PairProgScene /></Seq>
      <Seq t={S.history}><HistoryScene /></Seq>
      <Seq t={S.killResume}><KillResumeScene /></Seq>
      <Seq t={S.outro}><OutroScene /></Seq>

      {/* ── Captions ── */}
      <Caption text="One-click sign in" startFrame={140} endFrame={250} />
      <Caption text="Local daemon connects" sub="your data never leaves your machine" startFrame={320} endFrame={500} position="top" />
      <Caption text="Real-time agent supervision" sub="every file, every command, every dollar" startFrame={580} endFrame={780} />
      <Caption text="Loop detected" sub="edit → test → fail → edit — 4 cycles in 6 min" startFrame={890} endFrame={1070} />
      <Caption text="Scope drift alert" sub="agent went outside declared task scope" startFrame={1140} endFrame={1310} />
      <Caption text="Context & cost guardrails" sub="warnings before you waste tokens" startFrame={1400} endFrame={1590} />
      <Caption text="Checkpoint & rollback" sub="snapshot state, rewind when things go wrong" startFrame={1680} endFrame={1870} />
      <Caption text="Same session, any interface" sub="attach from CLI — conversation flows seamlessly" startFrame={1960} endFrame={2170} position="top" />
      <Caption text="Pair programming" sub="collaborate in real-time on AI sessions" startFrame={2260} endFrame={2520} position="top" />
      <Caption text="Unified timeline" sub="browser + CLI + collaborators — one history" startFrame={2610} endFrame={2750} />
      <Caption text="Full control" sub="kill, resume from checkpoint, your rules" startFrame={2830} endFrame={3010} />
    </AbsoluteFill>
  );
};

// ─── Helper ─────────────────────────────────────────────────────
const Seq: React.FC<{ t: readonly [number, number]; children: React.ReactNode }> = ({ t, children }) => (
  <Sequence from={t[0]} durationInFrames={t[1] - t[0]}>{children}</Sequence>
);

// ─── SCENE 1: Intro ─────────────────────────────────────────────
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 60 }, durationInFrames: 40 });
  const textOp = spring({ frame: frame - 35, fps, config: { damping: 18 }, durationInFrames: 25 });
  const fadeOut = clamp01(frame, 95, 120, 1, 0);

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: fadeOut }}>
      <div style={{ transform: `scale(${s})`, marginBottom: 24 }}><RadarLogo size={100} /></div>
      <div style={{ opacity: textOp, transform: `translateY(${lerp(textOp, 15, 0)}px)` }}>
        <span style={{ fontSize: 48, fontWeight: 700, color: colors.vigie400, fontFamily: fonts.display }}>vigie</span>
      </div>
      <div style={{ opacity: textOp * 0.7, marginTop: 8 }}>
        <span style={{ fontSize: 18, color: `${colors.cream200}80`, fontFamily: fonts.display, fontStyle: 'italic' }}>Eyes on the horizon.</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 2: Login ─────────────────────────────────────────────
const LoginScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const browserIn = spring({ frame, fps, config: { damping: 14, stiffness: 50 }, durationInFrames: 30 });
  const clicked = frame > 90;
  const flash = clicked ? spring({ frame: frame - 90, fps, config: { damping: 12 }, durationInFrames: 20 }) : 0;
  const fadeOut = clamp01(frame, 150, 170, 1, 0);

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: browserIn * fadeOut }}>
      <div style={{ width: 680, height: 480, transform: `scale(${lerp(browserIn, 0.9, 1)})` }}>
        <BrowserFrame url="app.vigie.tmonier.com/login">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24, position: 'relative' }}>
            {clicked && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle, ${colors.vigie400}15, transparent 70%)`, opacity: flash }} />}
            <RadarLogo size={48} />
            <span style={{ fontSize: 24, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display }}>Sign in to vigie</span>
            <GithubBtn clicked={clicked} />
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 3: Daemon start (split) ─────────────────────────────
const DaemonScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const termIn = spring({ frame, fps, config: { damping: 14, stiffness: 50 }, durationInFrames: 30 });
  const browserIn = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 50 }, durationInFrames: 30 });
  const wsOp = clamp01(frame, 110, 140, 0, 1);
  const fadeOut = clamp01(frame, 260, 280, 1, 0);
  const connected = frame > 130;

  const lines: TermLine[] = [
    { text: '$ vigie start', c: colors.vigie400, at: 25 },
    { text: '', c: '', at: 0 },
    { text: '  vigie v0.1.0', c: `${colors.cream200}70`, at: 50 },
    { text: '  daemon starting on localhost:4800...', c: colors.cream200, at: 70 },
    { text: '  ✓ daemon running', c: colors.success, at: 95 },
    { text: '  ✓ websocket server ready', c: colors.success, at: 115 },
    { text: '  watching for AI agent sessions', c: `${colors.cream200}60`, at: 140 },
    { text: '  local-first — your data never leaves your machine', c: `${colors.cream200}35`, at: 165 },
  ];

  return (
    <AbsoluteFill style={{ padding: 40, display: 'flex', gap: 0, opacity: fadeOut, position: 'relative' }}>
      <div style={{ flex: 1, opacity: termIn, transform: `translateX(${lerp(termIn, -40, 0)}px)` }}>
        <TerminalFrame title="zsh — ~/projects/my-app">
          <TermLines lines={lines} frame={frame} />
        </TerminalFrame>
      </div>
      <WebSocketLine x1={920} y1={350} x2={980} y2={350} opacity={wsOp} />
      <div style={{ flex: 1, opacity: browserIn, transform: `translateX(${lerp(browserIn, 40, 0)}px)` }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[]} />
            <Center>
              <StatusPill connected={connected} />
              {connected && (
                <span style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}40`, opacity: spring({ frame: frame - 140, fps, config: { damping: 18 }, durationInFrames: 15 }) }}>
                  ws://localhost:4800 · latency {'<'}1ms
                </span>
              )}
            </Center>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 4: Agent working ─────────────────────────────────────
const AgentWorkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 275, 300, 1, 0);

  const logs: TermLine[] = [
    { text: '✓ reading src/api/users.ts', c: colors.cream200, at: 60 },
    { text: '✓ reading src/middleware/auth.ts', c: colors.cream200, at: 90 },
    { text: '+ creating src/middleware/rate-limit.ts', c: colors.success, at: 130 },
    { text: '+ creating src/lib/redis.ts', c: colors.success, at: 160 },
    { text: '▶ running npm test', c: colors.cream50, at: 195 },
    { text: '  tests: 12 passed, 3 failed', c: colors.warning, at: 220 },
    { text: '✎ editing src/middleware/rate-limit.ts', c: colors.cream200, at: 250 },
  ];

  const ctx = clampVal(frame, 60, 250, 0, 38);
  const cost = clampVal(frame, 60, 250, 0, 1.85);
  const prompt = 'Add rate limiting to the /api/users endpoint. Use Redis with a sliding window of 100 req/min.';

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut }}>
      <div style={{ width: 1200, height: 700, transform: `scale(${lerp(fadeIn, 0.93, 1)})` }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: 'active', time: '2m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
              <AgentCard status="active" file={frame > 130 ? 'src/middleware/rate-limit.ts' : 'idle'} cost={`$${cost.toFixed(2)}`} context={Math.round(ctx)} />
              <PromptBox><TypedText text={prompt} startFrame={25} charsPerFrame={0.5} style={{ fontSize: 13, color: colors.cream50, lineHeight: '1.6' }} /></PromptBox>
              <LogPanel logs={logs} frame={frame} />
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 5: Loop detection ────────────────────────────────────
const LoopDetectScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 285, 310, 1, 0);

  const loopFrame = 140;
  const loopDetected = frame > loopFrame;
  const panelPop = loopDetected ? spring({ frame: frame - loopFrame - 15, fps, config: { damping: 12, stiffness: 70 }, durationInFrames: 25 }) : 0;

  // The repeating cycle — spaced out
  const logs: TermLine[] = [
    { text: '✎ editing rate-limit.ts', c: colors.cream200, at: 20 },
    { text: '▶ running npm test — 3 failed', c: colors.danger, at: 40 },
    { text: '✎ editing rate-limit.ts', c: colors.cream200, at: 65 },
    { text: '▶ running npm test — 3 failed', c: colors.danger, at: 85 },
    { text: '✎ editing rate-limit.ts', c: `${colors.cream200}80`, at: 105 },
    { text: '▶ running npm test — 3 failed', c: colors.danger, at: 125 },
    { text: '⚠ loop detected · edit → test → fail → edit — 4 cycles in 6 min', c: colors.warning, at: loopFrame },
  ];

  const suggestedPrompt = '“Tests expect a Redis mock — use ioredis-mock in the test setup instead of connecting to a real instance.”';
  const ctx = clampVal(frame, 0, loopFrame, 38, 65);
  const cost = clampVal(frame, 0, loopFrame, 1.85, 4.2);

  // Pulse amber border on loop
  const pulseOp = loopDetected ? 0.3 + Math.sin((frame - loopFrame) * 0.15) * 0.2 : 0;

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut }}>
      {/* Amber pulse overlay */}
      {loopDetected && <div style={{ position: 'absolute', inset: 0, border: `2px solid ${colors.warning}`, borderRadius: 20, opacity: pulseOp, pointerEvents: 'none', zIndex: 50 }} />}

      <div style={{ width: 1200, height: 720, transform: `scale(${lerp(fadeIn, 0.93, 1)})` }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: loopDetected ? 'paused' : 'active', time: '8m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <AgentCard status={loopDetected ? 'paused' : 'active'} file="src/middleware/rate-limit.ts" cost={`$${cost.toFixed(2)}`} context={Math.round(ctx)} />
              <LogPanel logs={logs} frame={frame} />

              {/* ── Action panel: loop detected ── */}
              {loopDetected && (
                <div style={{
                  opacity: panelPop, transform: `translateY(${lerp(panelPop, 10, 0)}px)`,
                  background: `${colors.navy800}60`, border: `1px solid ${colors.warning}40`, borderRadius: 10, padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{'⚠️'}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display }}>Agent paused — loop detected</span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.warning }}>$4.20 spent</span>
                  </div>
                  {/* Suggested prompt */}
                  <div style={{ background: `${colors.navy900}80`, border: `1px solid ${colors.cream200}15`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}35`, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Suggested prompt</div>
                    <TypedText text={suggestedPrompt} startFrame={loopFrame + 35} charsPerFrame={0.3} style={{ fontSize: 12, color: colors.cream50, fontStyle: 'italic', lineHeight: '1.6' }} />
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Btn label="Rollback #3" color={colors.vigie400} icon="↺" delay={loopFrame + 25} />
                    <Btn label="Send fix" color={colors.success} icon="→" delay={loopFrame + 32} />
                    <Btn label="Stop agent" color={colors.danger} delay={loopFrame + 39} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 6: Scope drift ───────────────────────────────────────
const ScopeDriftScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 235, 260, 1, 0);
  const driftFrame = 80;
  const driftDetected = frame > driftFrame;
  const alertPop = driftDetected ? spring({ frame: frame - driftFrame, fps, config: { damping: 12, stiffness: 80 }, durationInFrames: 22 }) : 0;

  const logs: TermLine[] = [
    { text: '✓ reading src/api/users.ts', c: colors.cream200, at: 20 },
    { text: '+ editing src/middleware/rate-limit.ts', c: colors.success, at: 40 },
    { text: '✎ editing package.json', c: colors.cream200, at: 65 },
    { text: '⚠ scope drift · package.json is outside declared scope', c: colors.warning, at: driftFrame },
    { text: '✎ editing tsconfig.json', c: colors.cream200, at: driftFrame + 30 },
    { text: '⚠ scope drift · tsconfig.json is outside declared scope', c: colors.warning, at: driftFrame + 40 },
  ];

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut }}>
      <div style={{ width: 1200, height: 700 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: 'active', time: '10m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <AgentCard status="active" file="package.json" cost="$2.50" context={45} />

              {/* Scope config */}
              <div style={{ background: `${colors.navy800}40`, border: `1px solid ${colors.cream200}10`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}35`, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Task scope</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['src/api/**', 'src/middleware/**', 'tests/**'].map((s) => (
                    <span key={s} style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.vigie400, background: `${colors.vigie400}12`, padding: '3px 10px', borderRadius: 5, border: `1px solid ${colors.vigie400}20` }}>{s}</span>
                  ))}
                </div>
              </div>

              <LogPanel logs={logs} frame={frame} />

              {/* Drift alert */}
              {driftDetected && (
                <div style={{
                  opacity: alertPop, transform: `translateY(${lerp(alertPop, 8, 0)}px)`,
                  background: `${colors.warning}08`, border: `1px solid ${colors.warning}30`, borderRadius: 10, padding: 14,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 24 }}>{'⚠️'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display, marginBottom: 2 }}>Scope drift detected</div>
                    <div style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}60` }}>Agent modified <span style={{ color: colors.warning }}>package.json</span> and <span style={{ color: colors.warning }}>tsconfig.json</span> — outside declared scope</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <Btn label="Revert" color={colors.warning} delay={driftFrame + 15} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 7: Context + Cost guardrails ─────────────────────────
const ContextCostScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 275, 300, 1, 0);

  const ctx = clampVal(frame, 0, 160, 45, 72);
  const cost = clampVal(frame, 0, 160, 2.5, 5.8);
  const ctxWarn = frame > 80;
  const costWarn = frame > 140;
  const modelHint = frame > 200;

  const ctxAlertPop = ctxWarn ? spring({ frame: frame - 80, fps, config: { damping: 14 }, durationInFrames: 22 }) : 0;
  const costAlertPop = costWarn ? spring({ frame: frame - 140, fps, config: { damping: 14 }, durationInFrames: 22 }) : 0;
  const modelPop = modelHint ? spring({ frame: frame - 200, fps, config: { damping: 14 }, durationInFrames: 22 }) : 0;

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut }}>
      <div style={{ width: 1200, height: 720 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: 'active', time: '12m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <AgentCard status="active" file="src/middleware/rate-limit.ts" cost={`$${cost.toFixed(2)}`} context={Math.round(ctx)} />

              {/* Context window warning */}
              {ctxWarn && (
                <AlertBox opacity={ctxAlertPop} color={colors.warning} icon="🧠">
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display }}>Context window at {Math.round(ctx)}%</div>
                  <div style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}60` }}>Agent may lose early instructions — consider a checkpoint</div>
                  <div style={{ marginTop: 6 }}><Btn label="Fresh window from checkpoint" color={colors.vigie400} delay={95} /></div>
                </AlertBox>
              )}

              {/* Cost guardrail */}
              {costWarn && (
                <AlertBox opacity={costAlertPop} color={colors.warning} icon="💰">
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display }}>Cost approaching budget ($6.00)</div>
                  <div style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}60` }}>Session will auto-pause at threshold</div>
                </AlertBox>
              )}

              {/* Cheaper model hint */}
              {modelHint && (
                <AlertBox opacity={modelPop} color={colors.vigie400} icon="💡">
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display }}>Model hint</div>
                  <div style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}60` }}>This task could run on <span style={{ color: colors.cream50 }}>sonnet</span> — ~3x cheaper for similar results</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <Btn label="Switch to sonnet" color={colors.vigie400} delay={215} />
                    <Btn label="Keep opus" color={`${colors.cream200}50`} delay={222} />
                  </div>
                </AlertBox>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 8: Checkpoint & Rollback ─────────────────────────────
const CheckpointScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 275, 300, 1, 0);

  const checkpoints = [
    { id: '#1', label: 'Initial state', time: '14:30', active: true },
    { id: '#2', label: 'Rate-limit middleware created', time: '14:33', active: frame > 30 },
    { id: '#3', label: 'Redis client added', time: '14:34', active: frame > 55 },
    { id: '#4', label: 'Before test fix attempt', time: '14:36', active: frame > 80 },
    { id: '#5', label: 'After ioredis-mock fix', time: '14:38', active: frame > 105 },
  ];

  const rollbackFrame = 150;
  const rolledBack = frame > rollbackFrame;
  const rollbackFlash = rolledBack ? spring({ frame: frame - rollbackFrame, fps, config: { damping: 10 }, durationInFrames: 20 }) : 0;

  const resumeFrame = 220;
  const resumed = frame > resumeFrame;

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut, position: 'relative' }}>
      {/* Rollback flash */}
      {rolledBack && !resumed && <div style={{ position: 'absolute', inset: 0, background: `${colors.vigie400}06`, opacity: rollbackFlash, zIndex: 20, pointerEvents: 'none' }} />}

      <div style={{ width: 1200, height: 720 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: rolledBack && !resumed ? 'paused' : 'active', time: '14m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <AgentCard status={rolledBack && !resumed ? 'paused' : 'active'} file={rolledBack ? (resumed ? 'resuming from #3...' : 'rolled back to #3') : 'src/middleware/rate-limit.ts'} cost="$4.20" context={rolledBack ? (resumed ? 35 : 31) : 65} />

              {/* Checkpoint timeline */}
              <div style={{ background: `${colors.navy900}80`, border: `1px solid ${colors.cream200}10`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}35`, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Checkpoints</div>
                {checkpoints.filter((cp) => cp.active).map((cp, i) => {
                  const isRollbackTarget = cp.id === '#3' && rolledBack;
                  return (
                    <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${colors.cream200}06` }}>
                      {/* Timeline dot */}
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: isRollbackTarget ? colors.vigie400 : `${colors.cream200}25`,
                        border: isRollbackTarget ? `2px solid ${colors.vigie400}` : `1px solid ${colors.cream200}15`,
                        boxShadow: isRollbackTarget ? `0 0 8px ${colors.vigie400}50` : 'none',
                      }} />
                      <span style={{ fontSize: 12, fontFamily: fonts.mono, color: isRollbackTarget ? colors.vigie400 : `${colors.cream200}60`, fontWeight: isRollbackTarget ? 700 : 400 }}>{cp.id}</span>
                      <span style={{ fontSize: 12, fontFamily: fonts.display, color: isRollbackTarget ? colors.cream50 : `${colors.cream200}50` }}>{cp.label}</span>
                      <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}30`, marginLeft: 'auto' }}>{cp.time}</span>
                      {isRollbackTarget && <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.vigie400, background: `${colors.vigie400}12`, padding: '1px 6px', borderRadius: 3 }}>{'←'} rollback here</span>}
                    </div>
                  );
                })}
              </div>

              {/* Rollback / resume */}
              {rolledBack && !resumed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 10, opacity: spring({ frame: frame - rollbackFrame - 5, fps, config: { damping: 14 }, durationInFrames: 15 }) }}>
                  <span style={{ fontSize: 13, fontFamily: fonts.mono, color: colors.vigie400 }}>{'✓'} Rolled back to checkpoint #3</span>
                  <Btn label="Resume from here" color={colors.success} delay={rollbackFrame + 10} />
                </div>
              )}
              {resumed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: 10, opacity: spring({ frame: frame - resumeFrame, fps, config: { damping: 14 }, durationInFrames: 15 }) }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.success, boxShadow: `0 0 8px ${colors.success}60` }} />
                  <span style={{ fontSize: 13, fontFamily: fonts.mono, color: colors.success }}>Session resumed from checkpoint #3 — fresh context</span>
                </div>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 9: Terminal attach (split) ───────────────────────────
const TerminalAttachScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 25, 0, 1);
  const fadeOut = clamp01(frame, 295, 320, 1, 0);
  const attached = frame > 90;

  return (
    <AbsoluteFill style={{ padding: 40, display: 'flex', gap: 0, opacity: fadeIn * fadeOut, position: 'relative' }}>
      <div style={{ flex: 0.85 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: 'active', time: '16m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AgentCard status="active" file="idle" cost="$3.20" context={35} />
              {attached && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: `${colors.vigie400}08`, borderRadius: 6, border: `1px solid ${colors.vigie400}15`, opacity: spring({ frame: frame - 95, fps, config: { damping: 18 }, durationInFrames: 15 }) }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.vigie400 }} />
                  <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.vigie400 }}>CLI attached to session</span>
                </div>
              )}
              {frame > 160 && (
                <div style={{ opacity: spring({ frame: frame - 160, fps, config: { damping: 14 }, durationInFrames: 12 }) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.warning, background: `${colors.warning}12`, padding: '2px 8px', borderRadius: 4 }}>via CLI</span>
                    <span style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}50` }}>new prompt received</span>
                  </div>
                </div>
              )}
              {frame > 190 && (
                <LogPanel logs={[
                  { text: '✓ reading tests/rate-limit.test.ts', c: colors.cream200, at: 195 },
                  { text: '+ installing ioredis-mock', c: colors.success, at: 215 },
                  { text: '▶ running npm test — 15 passed', c: colors.success, at: 245 },
                ]} frame={frame} />
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>

      <WebSocketLine x1={870} y1={350} x2={930} y2={350} opacity={fadeIn} showPulse={frame > 160} />

      <div style={{ flex: 1.15 }}>
        <TerminalFrame title="zsh — vigie attach a3f8c2d1">
          <TypedText text="$ vigie attach a3f8c2d1" startFrame={20} charsPerFrame={0.4} style={{ color: colors.vigie400 }} />
          {frame > 75 && <div style={{ height: 8 }} />}
          {frame > 75 && <div style={{ color: colors.success }}>{'✓'} attached to session a3f8c2d1</div>}
          {frame > 85 && <div style={{ color: `${colors.cream200}50` }}>  Claude Code (opus) · ~/projects/my-app</div>}
          {frame > 100 && <div style={{ height: 8 }} />}
          {frame > 100 && <div style={{ color: `${colors.cream200}40`, fontSize: 11 }}>{'───'} conversation {'───'}</div>}
          {frame > 110 && <div style={{ color: `${colors.cream200}70` }}><span style={{ color: colors.vigie400 }}>you:</span> Add rate limiting to /api/users...</div>}
          {frame > 125 && <div style={{ color: `${colors.cream200}50` }}><span style={{ color: `${colors.cream200}80` }}>claude:</span> I implemented the rate limiter...</div>}
          {frame > 140 && <div style={{ height: 8 }} />}
          {frame > 140 && (
            <div>
              <span style={{ color: colors.vigie400 }}>{'>'} </span>
              <TypedText text="Fix the tests — use ioredis-mock instead of real Redis" startFrame={142} charsPerFrame={0.4} style={{ color: colors.cream50, fontSize: 13 }} />
            </div>
          )}
          {frame > 240 && <div style={{ height: 8 }} />}
          {frame > 240 && <div style={{ color: `${colors.cream200}60` }}><span style={{ color: `${colors.cream200}80` }}>claude:</span> Good catch! Updating test setup...</div>}
          {frame > 265 && <div style={{ color: colors.success, fontWeight: 600 }}>{'✓'} All 15 tests passing</div>}
        </TerminalFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 10: Pair Programming ─────────────────────────────────
const PairProgScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 355, 380, 1, 0);

  const userJoins = frame > 50;
  const thinkingFlag = frame > 110;
  const sharedFile = frame > 180;
  const planEdit = frame > 250;

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut }}>
      <div style={{ width: 1280, height: 740 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: 'active', time: '20m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Collab header bar */}
              <div style={{ padding: '10px 18px', borderBottom: `1px solid ${colors.cream200}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.cream50, fontFamily: fonts.display }}>Rate-limit /api/users</span>
                  <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.success, background: `${colors.success}12`, padding: '2px 8px', borderRadius: 10 }}>live</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* User avatars */}
                  <Avatar letter="D" color={colors.vigie400} />
                  {userJoins && <Avatar letter="A" color="#A78BFA" delay={50} />}
                  {userJoins && (
                    <span style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}50`, opacity: spring({ frame: frame - 60, fps, config: { damping: 14 }, durationInFrames: 12 }) }}>
                      Alex joined
                    </span>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Main content area */}
                <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>

                  {/* Thinking flag */}
                  {thinkingFlag && (
                    <div style={{
                      opacity: spring({ frame: frame - 110, fps, config: { damping: 14 }, durationInFrames: 15 }),
                      background: `${colors.navy800}60`, border: `1px solid #A78BFA30`, borderRadius: 10, padding: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Avatar letter="A" color="#A78BFA" size={20} delay={0} />
                        <span style={{ fontSize: 11, fontFamily: fonts.mono, color: '#A78BFA' }}>Alex flagged thinking</span>
                        <span style={{ fontSize: 9, fontFamily: fonts.mono, color: `${colors.cream200}30`, background: `${colors.cream200}08`, padding: '1px 6px', borderRadius: 3 }}>{'💡'} FLAG</span>
                      </div>
                      <div style={{ fontSize: 12, fontFamily: fonts.display, color: `${colors.cream200}70`, lineHeight: '1.6', paddingLeft: 28 }}>
                        "The agent is creating a Redis client from scratch — we already have one in src/lib/db.ts. Should we point it there?"
                      </div>
                    </div>
                  )}

                  {/* Shared code viewer */}
                  {sharedFile && (
                    <div style={{
                      opacity: spring({ frame: frame - 180, fps, config: { damping: 14 }, durationInFrames: 15 }),
                      background: `${colors.navy900}90`, border: `1px solid ${colors.cream200}12`, borderRadius: 10, padding: 12, flex: 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}35`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shared viewer</span>
                          <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.vigie400 }}>src/middleware/rate-limit.ts</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Avatar letter="D" color={colors.vigie400} size={18} delay={0} />
                          <Avatar letter="A" color="#A78BFA" size={18} delay={0} />
                        </div>
                      </div>
                      {/* Fake code */}
                      <div style={{ fontFamily: fonts.mono, fontSize: 11, lineHeight: 1.9 }}>
                        <CodeLine n={1} text="import { Hono } from 'hono'" />
                        <CodeLine n={2} text="import { redis } from '../lib/redis'" highlight={frame > 200} />
                        <CodeLine n={3} text="" />
                        <CodeLine n={4} text="const WINDOW = 60 * 1000" />
                        <CodeLine n={5} text="const MAX_REQUESTS = 100" />
                        <CodeLine n={6} text="" />
                        <CodeLine n={7} text="export const rateLimiter = async (c, next) => {" />
                        <CodeLine n={8} text="  const key = `rate:${c.req.ip}`" />
                        <CodeLine n={9} text="  const count = await redis.incr(key)" highlight={frame > 220} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Plan panel (right side) */}
                {planEdit && (
                  <div style={{
                    width: 280, borderLeft: `1px solid ${colors.cream200}10`, padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
                    opacity: spring({ frame: frame - 250, fps, config: { damping: 14 }, durationInFrames: 15 }),
                  }}>
                    <div style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}35`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shared plan</div>
                    <PlanItem text="Create rate-limit middleware" done={true} />
                    <PlanItem text="Add Redis sliding window" done={true} />
                    <PlanItem text="Fix test setup (ioredis-mock)" done={true} />
                    <PlanItem text="Add integration tests" done={false} editedBy={frame > 290 ? 'A' : undefined} />
                    <PlanItem text="Update API docs" done={false} editedBy={frame > 310 ? 'D' : undefined} />
                    {frame > 320 && (
                      <div style={{
                        opacity: spring({ frame: frame - 320, fps, config: { damping: 14 }, durationInFrames: 12 }),
                        padding: '6px 10px', background: `#A78BFA10`, border: `1px dashed #A78BFA30`, borderRadius: 6,
                      }}>
                        <TypedText text="Add rate-limit headers to response" startFrame={325} charsPerFrame={0.25} style={{ fontSize: 11, color: `${colors.cream200}70` }} cursorColor="#A78BFA" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 11: History ──────────────────────────────────────────
const HistoryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 215, 240, 1, 0);

  const history = [
    { source: 'browser' as const, text: 'Add rate limiting to /api/users...', time: '14:32', who: 'Damien' },
    { source: 'agent' as const, text: 'Created rate-limit middleware, Redis client', time: '14:34', who: 'Claude' },
    { source: 'system' as const, text: '⚠ Loop detected — edit → test → fail (4 cycles)', time: '14:38', who: 'vigie' },
    { source: 'cli' as const, text: 'Fix tests — use ioredis-mock instead of real Redis', time: '14:39', who: 'Damien (CLI)' },
    { source: 'agent' as const, text: 'Updated test setup, all 15 tests passing', time: '14:40', who: 'Claude' },
    { source: 'collab' as const, text: 'Flagged: agent creating duplicate Redis client', time: '14:41', who: 'Alex' },
    { source: 'system' as const, text: '✓ Checkpoint #5 created', time: '14:42', who: 'vigie' },
  ];

  const sourceStyle: Record<string, { color: string; label: string }> = {
    browser: { color: colors.vigie400, label: 'BROWSER' },
    cli: { color: colors.warning, label: 'CLI' },
    agent: { color: `${colors.cream200}60`, label: 'AGENT' },
    system: { color: '#A78BFA', label: 'VIGIE' },
    collab: { color: '#F472B6', label: 'COLLAB' },
  };

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut }}>
      <div style={{ width: 1200, height: 700 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: 'active', time: '22m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}35`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unified timeline</div>
              <div style={{ background: `${colors.navy900}80`, border: `1px solid ${colors.cream200}10`, borderRadius: 10, padding: 14, flex: 1 }}>
                {history.map((entry, i) => {
                  const delay = 20 + i * 20;
                  const op = clamp01(frame, delay, delay + 8, 0, 1);
                  const s = sourceStyle[entry.source];
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', opacity: op, borderBottom: i < history.length - 1 ? `1px solid ${colors.cream200}06` : 'none' }}>
                      <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}30`, minWidth: 38, paddingTop: 2 }}>{entry.time}</span>
                      <span style={{ fontSize: 9, fontFamily: fonts.mono, fontWeight: 700, color: s.color, background: `${s.color}15`, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', alignSelf: 'flex-start', marginTop: 2 }}>{s.label}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}40`, marginBottom: 2 }}>{entry.who}</div>
                        <span style={{ fontSize: 13, fontFamily: fonts.display, color: colors.cream200, lineHeight: '1.5' }}>{entry.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 12: Kill & Resume ────────────────────────────────────
const KillResumeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = clamp01(frame, 0, 20, 0, 1);
  const fadeOut = clamp01(frame, 255, 280, 1, 0);
  const killF = 60; const resumeF = 170;
  const killed = frame > killF; const resumed = frame > resumeF;
  const killFlash = killed && !resumed ? clamp01(frame, killF, killF + 20, 1, 0) : 0;
  const resumeFlash = resumed ? clamp01(frame, resumeF, resumeF + 20, 1, 0) : 0;
  const status = resumed ? 'active' : killed ? 'ended' : 'active';

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fadeIn * fadeOut, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: `${colors.danger}06`, opacity: killFlash, zIndex: 20, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: `${colors.success}06`, opacity: resumeFlash, zIndex: 20, pointerEvents: 'none' }} />
      <div style={{ width: 1100, height: 650 }}>
        <BrowserFrame url="app.vigie.tmonier.com">
          <div style={{ display: 'flex', height: '100%' }}>
            <VigieSidebar sessions={[{ id: 'a3f8c2d1', project: '~/projects/my-app', status: status as 'active' | 'ended', time: '24m ago' }]} activeSessionId="a3f8c2d1" />
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AgentCard status={status as 'active' | 'ended'} file={resumed ? 'resuming...' : killed ? 'terminated' : 'idle'} cost="$3.20" context={resumed ? 35 : killed ? 0 : 58} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: 20 }}>
                {!killed && <div style={{ padding: '10px 24px', borderRadius: 8, background: `${colors.danger}12`, border: `1px solid ${colors.danger}30`, fontSize: 13, fontFamily: fonts.display, fontWeight: 600, color: colors.danger }}>Kill session</div>}
                {killed && !resumed && <div style={{ padding: '10px 24px', borderRadius: 8, background: `${colors.success}12`, border: `1px solid ${colors.success}30`, fontSize: 13, fontFamily: fonts.display, fontWeight: 600, color: colors.success, opacity: spring({ frame: frame - killF - 15, fps, config: { damping: 14 }, durationInFrames: 15 }) }}>Resume from checkpoint</div>}
                {resumed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: spring({ frame: frame - resumeF - 5, fps, config: { damping: 14 }, durationInFrames: 15 }) }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.success, boxShadow: `0 0 8px ${colors.success}60` }} />
                    <span style={{ fontSize: 14, fontFamily: fonts.mono, color: colors.success }}>Session resumed from checkpoint #5</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 13: Outro ────────────────────────────────────────────
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 50 }, durationInFrames: 30 });

  const features = [
    'Real-time supervision',
    'Loop detection',
    'Scope drift alerts',
    'Cost guardrails',
    'Checkpoints & rollback',
    'Terminal + Browser',
    'Pair programming',
  ];

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: s }}>
      <RadarLogo size={80} />
      <span style={{ fontSize: 56, fontWeight: 700, color: colors.vigie400, fontFamily: fonts.display }}>vigie</span>
      <span style={{ fontSize: 22, color: `${colors.cream200}70`, fontFamily: fonts.display, fontStyle: 'italic', marginBottom: 8 }}>Eyes on the horizon.</span>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700, marginBottom: 16 }}>
        {features.map((f, i) => (
          <div key={f} style={{
            opacity: spring({ frame: frame - 20 - i * 4, fps, config: { damping: 14 }, durationInFrames: 12 }),
            fontSize: 12, fontFamily: fonts.mono, color: colors.vigie400, background: `${colors.vigie400}10`, border: `1px solid ${colors.vigie400}25`, borderRadius: 20, padding: '5px 14px',
          }}>
            {f}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontFamily: fonts.mono, color: `${colors.cream200}50` }}>vigie.tmonier.com</span>
        <span style={{ color: `${colors.cream200}20` }}>{'·'}</span>
        <span style={{ fontSize: 14, fontFamily: fonts.mono, color: `${colors.cream200}50` }}>Open source · MIT</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── SHARED BUILDING BLOCKS ─────────────────────────────────────

type TermLine = { text: string; c: string; at: number };

const TermLines: React.FC<{ lines: TermLine[]; frame: number }> = ({ lines, frame }) => (
  <>
    {lines.map((l, i) => (
      <div key={i} style={{ opacity: frame > l.at ? 1 : 0, color: l.c }}>{l.text || ' '}</div>
    ))}
  </>
);

const AgentCard: React.FC<{ status: 'active' | 'ended' | 'paused'; file: string; cost: string; context: number }> = ({ status, file, cost, context }) => {
  const bc = status === 'active' ? `${colors.success}30` : status === 'paused' ? `${colors.warning}35` : `${colors.danger}20`;
  const sc = status === 'active' ? colors.success : status === 'paused' ? colors.warning : `${colors.cream200}40`;
  const cc = context > 60 ? colors.warning : colors.success;
  return (
    <div style={{ background: `${colors.navy800}60`, border: `1px solid ${bc}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, boxShadow: status === 'active' ? `0 0 6px ${colors.success}50` : 'none' }} />
          <span style={{ fontSize: 13, fontFamily: fonts.mono, color: colors.vigie400, fontWeight: 600 }}>Claude Code</span>
          <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}60`, background: `${colors.cream200}10`, padding: '1px 6px', borderRadius: 3 }}>opus</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontFamily: fonts.mono, color: sc, background: `${sc}12`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${sc}30` }}>{status}</span>
          <span style={{ fontSize: 12, fontFamily: fonts.mono, color: `${colors.cream200}80` }}>{cost}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}50`, marginBottom: 8 }}>{file}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}40` }}>context</span>
        <div style={{ flex: 1, height: 3, background: `${colors.cream200}15`, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${context}%`, height: '100%', background: cc, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}50`, minWidth: 28, textAlign: 'right' }}>{context}%</span>
      </div>
    </div>
  );
};

const LogPanel: React.FC<{ logs: TermLine[]; frame: number }> = ({ logs, frame }) => (
  <div style={{ background: `${colors.navy900}80`, border: `1px solid ${colors.cream200}10`, borderRadius: 8, padding: '10px 14px', flex: 1, overflow: 'hidden' }}>
    <div style={{ fontSize: 10, color: `${colors.cream200}35`, fontFamily: fonts.mono, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activity</div>
    {logs.map((l, i) => (
      <div key={i} style={{ fontSize: 12, fontFamily: fonts.mono, color: l.c, lineHeight: 1.9, opacity: frame > l.at ? 1 : 0 }}>{l.text}</div>
    ))}
  </div>
);

const PromptBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ background: `${colors.navy800}60`, border: `1px solid ${colors.vigie400}20`, borderRadius: 10, padding: '12px 16px' }}>
    <div style={{ fontSize: 10, color: `${colors.cream200}40`, fontFamily: fonts.mono, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prompt</div>
    {children}
  </div>
);

const AlertBox: React.FC<{ opacity: number; color: string; icon: string; children: React.ReactNode }> = ({ opacity, color, icon, children }) => (
  <div style={{ opacity, transform: `translateY(${lerp(opacity, 8, 0)}px)`, background: `${color}06`, border: `1px solid ${color}25`, borderRadius: 10, padding: 14, display: 'flex', gap: 12 }}>
    <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

const Btn: React.FC<{ label: string; color: string; icon?: string; delay: number }> = ({ label, color, icon, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = spring({ frame: frame - delay, fps, config: { damping: 14 }, durationInFrames: 12 });
  return (
    <div style={{ opacity: op, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: fonts.display, fontWeight: 600, color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 6, padding: '6px 14px', cursor: 'default' }}>
      {icon && <span>{icon}</span>}{label}
    </div>
  );
};

const StatusPill: React.FC<{ connected: boolean }> = ({ connected }) => (
  <div style={{ padding: '10px 24px', borderRadius: 20, background: connected ? `${colors.success}12` : `${colors.warning}12`, border: `1px solid ${connected ? `${colors.success}30` : `${colors.warning}30`}`, display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? colors.success : colors.warning, boxShadow: connected ? `0 0 8px ${colors.success}60` : 'none' }} />
    <span style={{ fontSize: 13, fontFamily: fonts.mono, color: connected ? colors.success : colors.warning }}>{connected ? 'Daemon connected' : 'Waiting for daemon...'}</span>
  </div>
);

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>{children}</div>
);

const GithubBtn: React.FC<{ clicked: boolean }> = ({ clicked }) => (
  <div style={{ padding: '14px 32px', borderRadius: 10, background: clicked ? colors.vigie400 : '#24292e', border: `1px solid ${clicked ? colors.vigie400 : '#444'}`, display: 'flex', alignItems: 'center', gap: 10, transform: clicked ? 'scale(0.97)' : 'scale(1)' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill={clicked ? colors.navy900 : 'white'}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
    <span style={{ fontSize: 15, fontWeight: 600, color: clicked ? colors.navy900 : 'white', fontFamily: fonts.display }}>{clicked ? 'Redirecting...' : 'Continue with GitHub'}</span>
  </div>
);

const RadarLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="24" fill="none" stroke={colors.vigie400} strokeWidth="2.5" />
    <circle cx="32" cy="32" r="16" fill="none" stroke={colors.vigie400} strokeWidth="1.5" opacity="0.7" />
    <circle cx="32" cy="32" r="8" fill="none" stroke={colors.vigie400} strokeWidth="1" opacity="0.5" />
    <circle cx="32" cy="32" r="3.5" fill={colors.vigie400} />
    <line x1="32" y1="8" x2="32" y2="2" stroke={colors.vigie400} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="52.8" y1="20" x2="57.4" y2="16.4" stroke={colors.vigie400} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="52.8" y1="44" x2="57.4" y2="47.6" stroke={colors.vigie400} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const Avatar: React.FC<{ letter: string; color: string; size?: number; delay?: number }> = ({ letter, color, size = 22, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = delay > 0 ? spring({ frame: frame - delay, fps, config: { damping: 14 }, durationInFrames: 12 }) : 1;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, color, fontWeight: 700, fontFamily: fonts.display, opacity: op, border: `1.5px solid ${color}40` }}>
      {letter}
    </div>
  );
};

const CodeLine: React.FC<{ n: number; text: string; highlight?: boolean }> = ({ n, text, highlight }) => (
  <div style={{ display: 'flex', gap: 12, background: highlight ? `${colors.vigie400}08` : 'transparent', margin: '0 -12px', padding: '0 12px', borderLeft: highlight ? `2px solid ${colors.vigie400}40` : '2px solid transparent' }}>
    <span style={{ color: `${colors.cream200}25`, minWidth: 24, textAlign: 'right', userSelect: 'none' }}>{n}</span>
    <span style={{ color: `${colors.cream200}70` }}>{text || ' '}</span>
  </div>
);

const PlanItem: React.FC<{ text: string; done: boolean; editedBy?: string }> = ({ text, done, editedBy }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
    <div style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${done ? colors.success : `${colors.cream200}25`}`, background: done ? `${colors.success}20` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: colors.success }}>
      {done ? '✓' : ''}
    </div>
    <span style={{ fontSize: 12, fontFamily: fonts.display, color: done ? `${colors.cream200}50` : colors.cream200, textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{text}</span>
    {editedBy && <Avatar letter={editedBy} color={editedBy === 'A' ? '#A78BFA' : colors.vigie400} size={16} delay={0} />}
  </div>
);

// ─── UTILS ──────────────────────────────────────────────────────
function clamp01(frame: number, from: number, to: number, a: number, b: number) {
  return interpolate(frame, [from, to], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
function clampVal(frame: number, from: number, to: number, a: number, b: number) {
  return interpolate(frame, [from, to], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
function lerp(t: number, a: number, b: number) {
  return a + (b - a) * t;
}
