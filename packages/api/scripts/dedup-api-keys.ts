import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

const { rows: duplicates } = await pool.query<{ id: string; name: string; createdAt: Date }>(`
  DELETE FROM apikey
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY name, "referenceId" ORDER BY "createdAt" DESC) AS rn
      FROM apikey
    ) ranked
    WHERE rn > 1
  )
  RETURNING id, name, "createdAt"
`);

if (duplicates.length === 0) {
  console.log('No duplicate API keys found.');
} else {
  console.log(`Deleted ${duplicates.length} duplicate API key(s):`);
  for (const row of duplicates) {
    console.log(`  - ${row.id} | ${row.name} | ${row.createdAt.toISOString()}`);
  }
}

await pool.end();
