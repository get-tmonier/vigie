export function KillAllForm({ count }: { count: number }) {
  return (
    <form action="/sessions/kill-all" method="POST" className="m-0">
      <button
        type="submit"
        className="text-[0.6rem] font-mono text-cream-200/50 hover:text-danger transition-colors cursor-pointer"
      >
        Kill all ({count})
      </button>
    </form>
  );
}
