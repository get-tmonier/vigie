import type { AgentSession } from '#modules/session/infrastructure/adapters/in/session.dto';

type Props = {
  sessions: AgentSession[];
  homedir: string;
};

export function DashboardPage({ sessions, homedir }: Props) {
  return (
    <div className="h-screen bg-navy-900 text-cream-50 font-body">
      <div
        id="vigie-initial-data"
        data-sessions={JSON.stringify(sessions)}
        data-homedir={homedir}
        className="hidden"
      />
      <div id="dashboard-app" className="h-full" />
    </div>
  );
}
