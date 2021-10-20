import db from "../services/db";
import { User } from "../types";

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
      profile_image_url
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
