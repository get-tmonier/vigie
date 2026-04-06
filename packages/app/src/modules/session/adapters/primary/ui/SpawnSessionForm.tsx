export function SpawnSessionForm() {
  return (
    <form
      action="/sessions/create"
      method="POST"
      className="p-3 shadow-[0_-1px_0_0_rgba(22,45,74,0.6)]"
    >
      <div className="flex gap-2 mb-2">
        <select
          name="agentType"
          className="px-2 py-1.5 font-mono text-xs bg-navy-800 text-cream-50 border border-navy-700 rounded focus:outline-none focus:border-vigie-400/50"
        >
          <option value="claude">claude</option>
          <option value="opencode">opencode</option>
        </select>
        <input
          name="cwd"
          type="text"
          placeholder="Working directory"
          defaultValue="~"
          className="flex-1 min-w-0 px-2 py-1.5 font-mono text-xs bg-navy-800 text-cream-50 border border-navy-700 rounded focus:outline-none focus:border-vigie-400/50 placeholder:text-cream-200/30"
        />
      </div>
      <button
        type="submit"
        className="w-full py-1.5 font-mono text-xs bg-vigie-400 text-navy-900 rounded hover:bg-vigie-500 transition-colors cursor-pointer"
      >
        + New session
      </button>
    </form>
  );
}
