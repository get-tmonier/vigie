type Props = {
  sidebar: React.ReactNode;
  main: React.ReactNode;
};

export function DashboardLayout({ sidebar, main }: Props) {
  return (
    <div className="flex h-screen bg-navy-900 text-cream-50 overflow-hidden font-body">
      <aside className="shrink-0 w-64 flex flex-col shadow-[1px_0_0_0_rgba(22,45,74,0.8)] bg-navy-900">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col min-w-0">{main}</main>
    </div>
  );
}
