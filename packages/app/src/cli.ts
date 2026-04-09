import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Console, Effect } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';
import { claudeCommand } from '#shell/infrastructure/adapters/in/commands/claude.command';
import { claudeInteractiveCommand } from '#shell/infrastructure/adapters/in/commands/claude-interactive.command';
import {
  daemonAttachCommand,
  daemonLogsCommand,
  daemonRestartCommand,
  daemonStartCommand,
  daemonStatusCommand,
  daemonStopCommand,
} from '#shell/infrastructure/adapters/in/commands/daemon.command';
import { openCommand } from '#shell/infrastructure/adapters/in/commands/open.command';
import { sessionAttachCommand } from '#shell/infrastructure/adapters/in/commands/session-attach.command';
import { sessionListCommand } from '#shell/infrastructure/adapters/in/commands/session-list.command';
import { sessionResumeCommand } from '#shell/infrastructure/adapters/in/commands/session-resume.command';

// ── Daemon subcommands ��─

const daemonStart = Command.make(
  'start',
  { fg: Flag.boolean('fg').pipe(Flag.withDefault(false)) },
  ({ fg }) => daemonStartCommand(fg)
);

const daemonStop = Command.make('stop', {}, () => daemonStopCommand());

const daemonStatus = Command.make('status', {}, () => daemonStatusCommand());

const daemonLogs = Command.make(
  'logs',
  {
    follow: Flag.boolean('follow').pipe(Flag.withAlias('f'), Flag.withDefault(false)),
  },
  ({ follow }) => daemonLogsCommand(follow)
);

const daemonRestart = Command.make('restart', {}, () => daemonRestartCommand());

const daemonAttach = Command.make('attach', {}, () => daemonAttachCommand());

const daemon = Command.make('daemon').pipe(
  Command.withDescription('Manage the vigie background daemon'),
  Command.withSubcommands([
    daemonStart,
    daemonStop,
    daemonStatus,
    daemonLogs,
    daemonRestart,
    daemonAttach,
  ])
);

// ── Claude command ──

const claude = Command.make(
  'claude',
  {
    prompt: Flag.string('prompt').pipe(
      Flag.optional,
      Flag.withAlias('p'),
      Flag.withDescription('The prompt to send to Claude Code')
    ),
  },
  ({ prompt }) => {
    if (prompt._tag === 'Some') {
      return claudeCommand(prompt.value);
    }
    return claudeInteractiveCommand();
  }
).pipe(Command.withDescription('Run Claude Code (interactive or with -p prompt)'));

// ── Session subcommands ──

const sessionList = Command.make(
  'list',
  {
    active: Flag.boolean('active').pipe(Flag.withDefault(false)),
    all: Flag.boolean('all').pipe(Flag.withDefault(false)),
  },
  ({ active, all }) => sessionListCommand(active, all)
).pipe(Command.withDescription('List sessions'));

const sessionAttach = Command.make(
  'attach',
  {
    id: Flag.string('id').pipe(Flag.withDescription('Session ID (partial match)')),
  },
  ({ id }) => sessionAttachCommand(id)
).pipe(Command.withDescription('Attach to an active interactive session'));

const sessionResume = Command.make(
  'resume',
  {
    id: Flag.string('id').pipe(Flag.withDescription('Session ID to resume (partial match)')),
  },
  ({ id }) => sessionResumeCommand(id)
).pipe(Command.withDescription('Resume an ended Claude session'));

const session = Command.make('session').pipe(
  Command.withDescription('Manage sessions'),
  Command.withSubcommands([sessionList, sessionAttach, sessionResume])
);

// ── Open command ──

const open = Command.make('open', {}, () => openCommand()).pipe(
  Command.withDescription('Open the vigie dashboard in your browser')
);

// ── Root command ──

const app = Command.make('vigie', {}, () =>
  Console.log(
    [
      'Usage: vigie <command>',
      '',
      'Commands:',
      '  daemon start         Start the background daemon',
      '  daemon start --fg    Start the daemon in foreground (blocking)',
      '  daemon stop          Stop the daemon',
      '  daemon restart       Stop then start the daemon',
      '  daemon status        Show daemon status',
      '  daemon logs          Show daemon logs',
      '  daemon attach        Attach to a running daemon and tail its logs',
      '  claude               Run Claude Code (interactive mode)',
      '  claude -p "..."      Run Claude Code with a prompt',
      '  session list         List sessions (--active, --all)',
      '  session attach --id  Attach to an active interactive session',
      '  session resume --id  Resume an ended Claude session',
      '  open                 Open the dashboard in your browser',
    ].join('\n')
  )
).pipe(Command.withSubcommands([daemon, claude, session, open]));

// ── Run ──

const program = Command.run(app, { version: '0.3.0' });

(program.pipe(Effect.provide(BunServices.layer)) as Effect.Effect<void, never, never>).pipe(
  BunRuntime.runMain()
);
