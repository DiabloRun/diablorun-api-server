import { broadcast } from "../services/ws";
import db from "../services/db";
import { Race, User } from "../types";

// Get user by clause
async function getUserByClause(
  clause: string,
  values?: any[]
): Promise<User | undefined> {
  const user = await db.query(
    `
    SELECT
      id,
      name,
      country_code,
      dark_color_from AS color,
      profile_image_url,
      race_id
    FROM users WHERE ${clause}
  `,
    values
  );

  if (!user.rows.length) {
    return;
  }

  return user.rows[0];
}

// Get user by authorization header
export async function getUserByAuthorizationHeader(header?: string) {
  if (!header) {
    return null;
  }

  const parts = header.trim().split(" ");

  if (parts.length !== 2) {
    return null;
  }

  return await getUserByApiKey(parts[1]);
}

// Get user by api key
export async function getUserByApiKey(apiKey: string) {
  return await getUserByClause("api_key=$1", [apiKey]);
}

// Get user by name or channel id
export async function getUserByName(name: string) {
  return await getUserByClause("login=$1 OR twitch_id=$1", [
    name.toLowerCase(),
  ]);
}

// Get user's last updated character id
export async function getLastUpdatedCharacterId(userId: number) {
  const { rows } = await db.query(
    `
        SELECT id FROM characters
        WHERE user_id=$1 ORDER BY update_time DESC LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) {
    return;
  }

  return rows[0].id;
}

export async function setUserRace(user: User, race: Race | null) {
  if (user.race_id) {
    await broadcast(`race/${user.race_id}`, {
      action: "leave_race_lobby",
      user,
      race: user.race_id,
    });
  }

  user.race_id = race?.id ?? null;

  await db.query(`UPDATE users SET race_id=$1 WHERE id=$2`, [
    race?.id ?? null,
    user.id,
  ]);

  if (race) {
    await broadcast(`race/${race.id}`, {
      action: "join_race_lobby",
      user,
      race: race.id,
    });
  }
}
