export function ClearEndedForm({ count }: { count: number }) {
  return (
    <form action="/sessions/clear-ended" method="POST" className="m-0">
      <button
        type="submit"
        className="text-[0.6rem] font-mono text-cream-200/50 hover:text-cream-200 transition-colors cursor-pointer"
      >
        Clear ({count})
      </button>
    </form>
  );
}
