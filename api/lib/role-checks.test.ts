import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { normalizeUsernameInput } from "../lib/identity";
import { getDb } from "./connection";

export async function findUserByUsername(username: string) {
  const normalized = normalizeUsernameInput(username);
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, normalized))
    .limit(1);
  return rows.at(0);
}

export async function createUser(data: {
  username: string;
  passwordHash: string;
  name: string;
}) {
  const normalized = normalizeUsernameInput(data.username);
  await getDb().insert(schema.users).values({
    username: normalized,
    passwordHash: data.passwordHash,
    name: data.name,
    unionId: null,
    role: "user",
    lastSignInAt: new Date(),
  });
  return findUserByUsername(normalized);
}

export async function touchLastSignIn(id: number) {
  await getDb()
    .update(schema.users)
    .set({ lastSignInAt: new Date() })
    .where(eq(schema.users.id, id));
}
