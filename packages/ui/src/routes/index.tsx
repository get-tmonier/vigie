import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="font-vollkorn-sc text-5xl font-bold text-gold m-0">tmonier</h1>
      <p className="font-source-serif text-xl text-cream m-0">Your local-first SWE companion.</p>
      <code className="font-mono text-sm text-gold-light bg-navy-mid px-4 py-2 rounded-md">
        @tmonier/ui is running
      </code>
    </div>
  );
}
