import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import pg from "pg";
import { getPgPool } from "@/storage/database/travel-records";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

let usersTableReady = false;

export interface AppUser {
  id: number;
  username: string;
  created_at: string;
}

interface UserRow extends AppUser {
  password_hash: string;
  password_salt: string;
}

async function ensureUsersTable(): Promise<void> {
  if (usersTableReady) return;

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  usersTableReady = true;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function validateUsername(username: string): void {
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    throw new Error("用户名需为 3-30 位字母、数字或下划线");
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error("密码至少需要 8 位");
  }
}

async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex")
): Promise<{ hash: string; salt: string }> {
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

async function verifyPassword(
  password: string,
  passwordHash: string,
  salt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  const expected = Buffer.from(passwordHash, "hex");
  const actual = Buffer.from(hash, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createUser(
  usernameInput: string,
  password: string
): Promise<AppUser> {
  await ensureUsersTable();

  const username = normalizeUsername(usernameInput);
  validateUsername(username);
  validatePassword(password);

  const { hash, salt } = await hashPassword(password);

  try {
    const { rows } = await getPgPool().query<AppUser>(
      `INSERT INTO app_users (username, password_hash, password_salt)
       VALUES ($1, $2, $3)
       RETURNING id, username, created_at::text AS created_at`,
      [username, hash, salt]
    );

    return rows[0];
  } catch (error) {
    if (
      error instanceof pg.DatabaseError &&
      error.code === "23505"
    ) {
      throw new Error("用户名已存在");
    }
    throw error;
  }
}

export async function authenticateUser(
  usernameInput: string,
  password: string
): Promise<AppUser | null> {
  await ensureUsersTable();

  const username = normalizeUsername(usernameInput);
  const { rows } = await getPgPool().query<UserRow>(
    `SELECT id, username, password_hash, password_salt, created_at::text AS created_at
     FROM app_users
     WHERE username = $1`,
    [username]
  );

  const user = rows[0];
  if (!user) return null;

  const isValid = await verifyPassword(
    password,
    user.password_hash,
    user.password_salt
  );

  if (!isValid) return null;

  return {
    id: user.id,
    username: user.username,
    created_at: user.created_at,
  };
}

export async function getUserById(id: number): Promise<AppUser | null> {
  await ensureUsersTable();

  const { rows } = await getPgPool().query<AppUser>(
    `SELECT id, username, created_at::text AS created_at
     FROM app_users
     WHERE id = $1`,
    [id]
  );

  return rows[0] ?? null;
}
