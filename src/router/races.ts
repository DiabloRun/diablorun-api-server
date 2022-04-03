import * as shortid from "shortid";
import { Router } from "express";
import db from "../services/db";
import * as sql from "pg-format";
import { broadcast } from "../services/ws";

export const router = Router();

// Get recent races
router.get("/races", async function (req, res) {
  const races = await db.query(`
        SELECT
            id, type, name, slug, start_time, finish_time, description,
            finish_conditions_global,
            entry_new_character,
            entry_ama, entry_sor,
            entry_nec, entry_pal,
            entry_bar, entry_dru,
            entry_asn, entry_classic,
            entry_hc, entry_players
        FROM races ORDER BY start_time DESC NULLS LAST LIMIT 10
    `);

  res.json(races.rows);
});

// Get race settings using editor token
router.get("/races/editor", async function (req, res) {
  const editorToken = req.query.editor_token;

  const race = await db.query(
    `
        SELECT * FROM races WHERE editor_token=$1
    `,
    [editorToken]
  );

  if (!race.rows.length) {
    res.sendStatus(404);
    return;
  }

  const rules = await db.query(
    `
        SELECT * FROM race_rules WHERE race_id = $1
    `,
    [race.rows[0].id]
  );

  res.json({
    race: race.rows[0],
    rules: rules.rows,
  });
});

// Get race by id
router.get("/races/:id", async function (req, res) {
  const id = req.params.id;
  const time = Math.floor(Date.now() / 1000);

  const [race, lobby, rules, characters] = await Promise.all([
    // Fetch race
    db.query(
      `
            SELECT
                id, type, name, description, slug,
                start_time, finish_time,
                estimated_start_time,
                finish_conditions_global,
                entry_ama, entry_sor,
                entry_nec, entry_pal,
                entry_bar, entry_dru,
                entry_asn, entry_classic,
                entry_hc, entry_players,
                active, token
            FROM races WHERE id=$1
        `,
      [id]
    ),
    // Fetch users in lobby
    db.query(
      `SELECT
        id, name, country_code, dark_color_from AS color, profile_image_url, race_id
      FROM users WHERE race_id=$1`,
      [id]
    ),
    // Fetch rules
    db.query(
      `
            SELECT * FROM race_rules WHERE race_id = $1
        `,
      [id]
    ),
    // Fetch characters
    db.query(
      `
            WITH latest_characters AS (
                SELECT DISTINCT ON (characters.user_id) 
                characters.*, race_characters.*, ${time} - race_characters.start_time AS time FROM race_characters
                INNER JOIN characters ON characters.id = race_characters.character_id
                WHERE race_characters.race_id=$1
                ORDER BY characters.user_id, characters.update_time DESC
            ), rankings AS (
                SELECT latest_characters.*,
                (RANK() OVER (
                    ORDER BY points DESC
                ))::integer AS rank
                FROM latest_characters
            )
            SELECT
                rankings.*,
                users.name AS user_name,
                users.country_code AS user_country_code,
                users.dark_color_from AS user_color
            FROM rankings
            INNER JOIN users ON rankings.user_id = users.id
            ORDER BY rank
        `,
      [id]
    ),
  ]);

  if (!race.rows[0].active) {
    delete race.rows[0].token;
  }

  // Value
  res.json({
    time: new Date().getTime(),
    race: race.rows[0],
    rules: rules.rows,
    characters: characters.rows,
    lobby: lobby.rows,
    // notifications: notifications.rows,
    // pointsLog: race.rows[0].start_time ? pointsLog.rows : []
  });
});

// Save race settings
router.post("/races", async function (req, res) {
  const race = req.body;

  if (race.start_in) {
    race.start_time = Math.floor(Date.now() / 1000) + race.start_in;

    /*
    race.finish_time = null;

    const conditions = await db.query(
      `
            SELECT time_type, time_seconds FROM race_rules
            WHERE race_id=$1 AND context='finish_conditions' AND type='time'
        `,
      [race.id]
    );

    if (conditions.rows.length) {
      race.preliminary_character_finish_time = Math.min(
        ...conditions.rows.map(
          ({ time_seconds }) => race.start_time + time_seconds
        )
      );
    }
    */
  }

  if (race.end) {
    race.finish_time = Math.floor(Date.now() / 1000);
  }

  // Update race configuration
  if (race.editor_token) {
    const update = await db.query(
      sql(
        `
            UPDATE races SET
                type=%L, name=%L, slug=%L, description=%L,
                finish_conditions_global=%L,
                start_time=%L, finish_time=%L,
                entry_new_character=%L,
                entry_ama=%L, entry_sor=%L,
                entry_nec=%L, entry_pal=%L,
                entry_bar=%L, entry_dru=%L,
                entry_asn=%L, entry_classic=%L,
                entry_hc=%L, entry_players=%L,
                estimated_start_time=%L
            WHERE editor_token=%L RETURNING id
        `,
        race.type,
        race.name,
        race.slug,
        race.description,
        race.finish_conditions_global,
        race.start_time,
        race.finish_time,
        race.entry_new_character,
        race.entry_ama,
        race.entry_sor,
        race.entry_nec,
        race.entry_pal,
        race.entry_bar,
        race.entry_dru,
        race.entry_asn,
        race.entry_classic,
        race.entry_hc,
        race.entry_players,
        race.estimated_start_time,
        race.editor_token
      )
    );

    race.id = update.rows[0].id;
  } else {
    race.token = shortid();
    race.editor_token = shortid();

    const insert = await db.query(
      sql(
        `
            INSERT INTO races (
                type, name, slug, description,
                token, editor_token,
                finish_conditions_global,
                entry_new_character,
                entry_ama, entry_sor,
                entry_nec, entry_pal,
                entry_bar, entry_dru,
                entry_asn, entry_classic,
                entry_hc, entry_players,
                estimated_start_time
            )
            VALUES (%L) RETURNING id
        `,
        [
          race.type,
          race.name,
          race.slug,
          race.description,
          race.token,
          race.editor_token,
          race.finish_conditions_global,
          race.entry_new_character,
          race.entry_ama,
          race.entry_sor,
          race.entry_nec,
          race.entry_pal,
          race.entry_bar,
          race.entry_dru,
          race.entry_asn,
          race.entry_classic,
          race.entry_hc,
          race.entry_players,
          race.estimated_start_time,
        ]
      )
    );

    race.id = insert.rows[0].id;
  }

  // Update race rules
  if (race.update_rules) {
    await db.query(`DELETE FROM character_checkpoints WHERE race_id=$1`, [
      race.id,
    ]);
    await db.query(`DELETE FROM race_notifications WHERE race_id=$1`, [
      race.id,
    ]);
    await db.query(`DELETE FROM race_rules WHERE race_id=$1`, [race.id]);

    if (race.rules.length) {
      await db.query(
        `
                INSERT INTO race_rules (
                    race_id, context, type, amount,
                    stat, counter,
                    difficulty, quest_id,
                    time_type, time, time_seconds
                ) VALUES ${race.rules.map(
                  (_: any, i: number) => `(
                    $1, $${10 * i + 2}, $${10 * i + 3}, $${10 * i + 4},
                    $${10 * i + 5}, $${10 * i + 6},
                    $${10 * i + 7}, $${10 * i + 8},
                    $${10 * i + 9}, $${10 * i + 10}, $${10 * i + 11}
                )`
                )}
            `,
        [
          race.id,
          ...Array.prototype.concat(
            ...race.rules.map((point: any) => [
              point.context,
              point.type,
              point.amount || 0,
              point.stat,
              point.counter || 0,
              point.difficulty,
              point.quest_id || 0,
              point.time_type,
              point.time,
              point.time_seconds || 0,
            ])
          ),
        ]
      );
    }
  }

  // Alert race start or end
  const room = `race/${race.id}`;
  const twitchMessages = [];

  if (race.start_in) {
    const participants = await db.query(
      `SELECT name FROM users WHERE race_id=$1`,
      [race.id]
    );

    for (const { name } of participants.rows) {
      twitchMessages.push({
        channel: `#${name}`,
        message: `diablo.run/race/${race.id} starting in ${race.start_in} seconds!`,
      });

      twitchMessages.push({
        channel: `#${name}`,
        message: `diablo.run/race/${race.id} has started!`,
        timeout: race.start_in * 1000,
      });
    }
  }

  if (race.end) {
    await db.query(
      `UPDATE race_characters SET finish_time=$1 WHERE race_id=$2 AND finish_time IS NULL`,
      [race.finish_time, race.id]
    );

    const participants = await db.query(
      `SELECT name FROM users WHERE race_id=$1`,
      [race.id]
    );

    for (const { name } of participants.rows) {
      twitchMessages.push({
        channel: `#${name}`,
        message: `diablo.run/race/${race.id} has ended!`,
      });
    }
  }

  // Broadcast changes to race subscribers
  await broadcast(room, {
    room,
    action: "race",
    payload: {
      race: {
        ...race,
        token: undefined,
        editor_token: undefined,
        points: undefined,
        finish_conditions: undefined,
        update_rules: undefined,
      },
      rules: race.update_rules ? race.rules : undefined,
    },
  });

  res.json(race);
});

// Get active race
export async function getActiveRace() {
  const { rows } = await db.query(`
        SELECT
            id, type, name, slug, start_time, finish_time, description,
            finish_conditions_global,
            entry_new_character,
            entry_ama, entry_sor,
            entry_nec, entry_pal,
            entry_bar, entry_dru,
            entry_asn, entry_classic,
            entry_hc, entry_players,
            token
        FROM races
        WHERE active=true LIMIT 1
    `);

  return rows.length ? rows[0] : null;
}
