import pg from "pg";

let pool: pg.Pool | null = null;
let travelRecordsTableReady = false;

function getDatabaseUrl(): string {
  const url = process.env.PGDATABASE_URL;
  if (!url) {
    throw new Error("PGDATABASE_URL is not set");
  }
  return url.startsWith("postgres://")
    ? `postgresql://${url.slice("postgres://".length)}`
    : url;
}

export function getPgPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
    });
  }
  return pool;
}

async function ensureTravelRecordsTable(): Promise<void> {
  if (travelRecordsTableReady) return;

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS travel_records (
      id SERIAL PRIMARY KEY,
      destination VARCHAR(255) NOT NULL,
      travel_time VARCHAR(255) NOT NULL,
      result TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPgPool().query(
    "ALTER TABLE travel_records ADD COLUMN IF NOT EXISTS user_id INTEGER"
  );
  await getPgPool().query(
    "ALTER TABLE travel_records ADD COLUMN IF NOT EXISTS username VARCHAR(80)"
  );
  await getPgPool().query(
    "CREATE INDEX IF NOT EXISTS travel_records_user_created_at_idx ON travel_records (user_id, created_at DESC)"
  );

  travelRecordsTableReady = true;
}

export interface TravelRecord {
  id: number;
  user_id: number | null;
  username: string | null;
  destination: string;
  travel_time: string;
  result: string | null;
  created_at: string;
}

export async function insertTravelRecord(
  userId: number,
  username: string,
  destination: string,
  travelTime: string
): Promise<number> {
  await ensureTravelRecordsTable();

  const { rows } = await getPgPool().query<{ id: number }>(
    `INSERT INTO travel_records (user_id, username, destination, travel_time)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, username, destination, travelTime]
  );
  return rows[0].id;
}

export async function updateTravelRecordResult(
  id: number,
  result: string
): Promise<void> {
  await ensureTravelRecordsTable();

  await getPgPool().query(
    "UPDATE travel_records SET result = $1 WHERE id = $2",
    [result, id]
  );
}

export async function listTravelRecords(
  userId: number,
  limit: number
): Promise<TravelRecord[]> {
  await ensureTravelRecordsTable();

  const { rows } = await getPgPool().query<TravelRecord>(
    `SELECT id, user_id, username, destination, travel_time, result, created_at::text AS created_at
     FROM travel_records
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}
