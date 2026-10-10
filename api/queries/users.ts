import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export async function findUserByUsername(username: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);
  return rows.at(0);
}

export async function createUser(data: {
  username: string;
  passwordHash: string;
  name: string;
}) {
  await getDb().insert(schema.users).values({
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    unionId: null,
    role: "user",
    lastSignInAt: new Date(),
  });
  return findUserByUsername(data.username);
}

export async function touchLastSignIn(id: number) {
  await getDb()
    .update(schema.users)
    .set({ lastSignInAt: new Date() })
    .where(eq(schema.users.id, id));
}
