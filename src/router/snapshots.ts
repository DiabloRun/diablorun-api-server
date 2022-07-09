import { Router } from "express";
import db from "../services/db";
import * as sql from "pg-format";
import { getUserByName } from "../collections/users";
import {
  CharacterItem,
  CharacterQuest,
  CharacterSnapshot,
  CharacterSuperUnique,
  Race,
} from "src/types";
import { itemImages } from "@diablorun/diablorun-data";

export const router = Router();

async function getCharacterSnapshot(
  clause: string
): Promise<CharacterSnapshot> {
  const characters = await db.query(`
    SELECT
      characters.*,
      users.name AS user_name,
      users.country_code AS user_country_code,
      users.dark_color_from AS user_color,
      users.profile_image_url AS user_profile_image_url
    FROM characters
    INNER JOIN users ON characters.user_id = users.id
    WHERE ${clause}
  `);

  if (!characters.rows.length) {
    throw { status: 404, message: "Character not found" };
  }

  const character = characters.rows[0];
  const [items, quests, superUniques, races] = await Promise.all([
    await db.query<CharacterItem>(
      `SELECT * FROM character_items WHERE character_id=${character.id}`
    ),
    await db.query<CharacterQuest>(
      `SELECT update_time, difficulty, quest_id FROM quests WHERE character_id=${character.id}`
    ),
    await db.query<CharacterSuperUnique>(
      `SELECT update_time, difficulty, monster_id FROM super_uniques WHERE character_id=${character.id}`
    ),
    await db.query<Race>(`
      SELECT race_characters.*, races.id, races.name, races.description, races.entry_hc, races.entry_players,
        races.entry_classic, races.entry_ama, races.entry_sor, races.entry_nec, races.entry_pal, races.entry_bar,
        races.entry_dru, races.entry_asn
      FROM race_characters
      INNER JOIN races ON races.id = race_characters.race_id
      WHERE character_id=${character.id}
    `),
  ]);

  return {
    character,
    items: items.rows.map((item) => {
      /*
      let runeword;
      const runewordMatch = item.name.match(/^(.*?) \[(.*?)\]$/);

      if (runewordMatch) {
        runeword = runewordMatch[2];
      }
      */

      return {
        ...item,
        // name: runeword ? item.base_name : item.name,
        // runeword,
        // properties: JSON.parse(item.properties),
        imageUrl: itemImages[item.name] || itemImages[item.base_name],
      };
    }),
    quests: quests.rows,
    superUniques: superUniques.rows,
    races: races.rows,
  };
}

export async function getCharacterSnapshotById(id: number) {
  return await getCharacterSnapshot(sql("characters.id=%L", id));
}

export async function getCharacterSnapshotByUserId(id: number) {
  return await getCharacterSnapshot(
    sql(
      `characters.user_id=%L ORDER BY characters.update_time DESC LIMIT 1`,
      id
    )
  );
}

export async function getCharacterSnapshotByUsername(username: string) {
  const user = await getUserByName(username);

  if (!user) {
    return;
  }

  return await getCharacterSnapshotByUserId(user.id);
}

// Get latest character snapshot by user name
router.get("/snapshots/users/:name", async function (req, res) {
  const snapshot = await getCharacterSnapshotByUsername(req.params.name);

  if (!snapshot) {
    throw { status: 404, message: "User not found" };
  }

  res.json(snapshot);
});

// Get character snapshot by id
router.get("/snapshots/characters/:id", async function (req, res) {
  const snapshot = await getCharacterSnapshotById(parseInt(req.params.id));
  res.json(snapshot);
});
