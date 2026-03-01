import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1.5rem',
      }}
    >
      <h1
        style={{
          fontFamily: '"Vollkorn SC", serif',
          fontSize: '3rem',
          fontWeight: 700,
          color: 'var(--gold)',
          margin: 0,
        }}
      >
        tmonier
      </h1>
      <p
        style={{
          fontFamily: '"Source Serif 4", serif',
          fontSize: '1.25rem',
          color: 'var(--cream)',
          margin: 0,
        }}
      >
        Your local-first SWE companion.
      </p>
      <code
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.875rem',
          color: 'var(--gold-light)',
          backgroundColor: 'var(--navy-mid)',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
        }}
      >
        @tmonier/ui is running
      </code>
    </div>
  );
}
