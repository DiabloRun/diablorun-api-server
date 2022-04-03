import { config } from "dotenv";
config();

import db from "../services/db";
import * as sqlFormat from "pg-format";
import * as speedrunCom from "./speedrun-com";
import { Speedrun, SpeedrunUser } from "../types";

async function run() {
  await db.connect();

  // Get speedrun.com sync offset
  const res = await db.query(
    "SELECT MAX(speedrun_offset) AS offset FROM speedruns"
  );
  let offset = res.rows[0].offset ? res.rows[0].offset + 1 : 0;
  offset = 0;

  // Fetch speedrun.com runs
  const speedruns: Speedrun[] = [];
  const userIds = new Set<string>();
  const characterIds = new Set<number>();

  while (1) {
    console.log(`[INFO] Fetching speedrun.com runs from offset ${offset}...`);
    const { data, more, nextOffset } = await speedrunCom.fetchRuns(offset);

    for (const run of data) {
      if (run.speedrun_user_id) {
        userIds.add(run.speedrun_user_id);
      }

      if (run.character_id) {
        characterIds.add(run.character_id);
      }

      speedruns.push(run);
    }

    offset = nextOffset;

    if (!more) {
      break;
    }

    await new Promise<void>((r) => setTimeout(r, 500));
  }

  // Fetch speedrun.com users
  console.log("[INFO] Fetching speedrun.com users...");
  const speedrunUsers = await speedrunCom.fetchUsers(Array.from(userIds));

  // Save users
  console.log("[INFO] Saving users...");

  await Promise.all(
    speedrunUsers.map(async (user) => {
      const keys = Object.keys(user) as (keyof SpeedrunUser)[];
      const values = keys.map((key) => user[key]);

      await db.query(
        sqlFormat(
          `
            INSERT INTO speedrun_users (${keys}) VALUES (${keys.map(
            (_, i) => `%${i + 1}$L`
          )})
            ON CONFLICT (id) DO UPDATE SET ${keys.map(
              (key, i) => `${key}=%${i + 1}$L`
            )}
        `,
          ...values
        )
      );
    })
  );

  // Save runs
  console.log("[INFO] Saving runs...");

  await Promise.all(
    speedruns.map(async (speedrun) => {
      const keys = Object.keys(speedrun) as (keyof Speedrun)[];
      const values = keys.map((key) => speedrun[key]);

      try {
        await db.query(
          sqlFormat(
            `
                INSERT INTO speedruns (${keys}) VALUES (${keys.map(
              (_, i) => `%${i + 1}$L`
            )})
                ON CONFLICT (speedrun_id) DO UPDATE SET ${keys.map(
                  (key, i) => `${key}=%${i + 1}$L`
                )}
            `,
            ...values
          )
        );
      } catch (err) {
        console.log(err);
      }
    })
  );

  // Update user ids from characters and speedrun users tables
  await db.query(
    "UPDATE speedruns SET user_id=(SELECT user_id FROM characters WHERE id=speedruns.character_id) WHERE character_id IS NOT NULL"
  );
  await db.query(
    "UPDATE speedruns SET user_id=(SELECT user_id FROM speedrun_users WHERE id=speedruns.speedrun_user_id) WHERE user_id IS NULL"
  );

  // Update user profiles based on speedrun users table
  await db.query(
    "UPDATE users SET country_code=(SELECT country_code FROM speedrun_users WHERE user_id=users.id) WHERE country_code IS NULL"
  );
  await db.query(
    "UPDATE users SET dark_color_from=(SELECT dark_color_from FROM speedrun_users WHERE user_id=users.id) WHERE dark_color_from IS NULL"
  );
  await db.query(
    "UPDATE users SET dark_color_to=(SELECT dark_color_to FROM speedrun_users WHERE user_id=users.id) WHERE dark_color_to IS NULL"
  );
  await db.query(
    "UPDATE users SET light_color_from=(SELECT light_color_from FROM speedrun_users WHERE user_id=users.id) WHERE light_color_from IS NULL"
  );
  await db.query(
    "UPDATE users SET light_color_to=(SELECT light_color_to FROM speedrun_users WHERE user_id=users.id) WHERE light_color_to IS NULL"
  );

  await db.end();
}

run();
