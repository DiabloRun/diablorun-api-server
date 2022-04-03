import * as dotenv from "dotenv";
import { getUserByApiKey, setUserRace } from "../collections/users";
import { Character, CharacterSnapshot } from "../types";
import db from "../services/db";
import { getItemUpdates, saveItemUpdates } from "./item-updates";
import { Payload } from "./payload";
import { getCharacterUpdates, saveCharacterUpdates } from "./character-updates";
import { getQuestUpdates, saveQuestUpdates } from "./quest-updates";
import { broadcast } from "../services/ws";
import { getCurrentLadder } from "../collections/ladders";
import {
  getRaceByArgs,
  getRaceUpdates,
  joinRace,
  saveRaceUpdates,
} from "./race-updates";

const [MIN_MAJOR, MIN_MINOR, MIN_PATCH] = (
  process.env.MIN_DI_VERSION || "0.0.0"
)
  .split(".")
  .map((i) => parseInt(i));

async function getLatestCharacterByName(
  userId: number,
  name: string
): Promise<Character | undefined> {
  const characters = await db.query(
    `
        SELECT * FROM characters
        WHERE user_id=$1 AND name=$2 ORDER BY start_time DESC LIMIT 1
    `,
    [userId, name]
  );

  if (!characters.rows.length) {
    return;
  }

  return characters.rows[0];
}

export async function sync(payload: Payload) {
  // Sync time
  const time = Math.floor(new Date().getTime() / 1000);

  // Verify DI version
  const version = payload.DIApplicationInfo.Version;
  const [major, minor, patch] = version.split(".").map((v) => parseInt(v));

  if (
    major < MIN_MAJOR ||
    (major === MIN_MAJOR && minor < MIN_MINOR) ||
    (minor === MIN_MINOR && patch < MIN_PATCH)
  ) {
    throw {
      status: 400,
      message: `DiabloRun supports DiabloInterface ${MIN_MAJOR}.${MIN_MINOR}.${MIN_PATCH} or later, you are currently running ${version}. Download the latest release from https://github.com/DiabloRun/DiabloInterface/releases`,
    };
  }

  // Get user from headers
  const headers = dotenv.parse(payload.Headers);
  const user = await getUserByApiKey(headers.API_KEY);

  if (!user) {
    throw {
      status: 400,
      message: `Invalid or missing API_KEY. Visit https://diablo.run/setup`,
    };
  }

  if (user.id === 1 || user.id === 2) {
    console.log(user.id, payload.KilledMonsters);
  }

  // Get active race by args
  const race = await getRaceByArgs(
    payload.D2ProcessInfo.CommandLineArgs.join(" ")
  );

  if (user.race_id !== (race?.id ?? null)) {
    await setUserRace(user, race);
  }

  // Stop if no character data is provided
  if (payload.Event === "ProcessFound") {
    return;
  }

  // Get character snapshot before update
  let before: CharacterSnapshot | undefined;

  if (!payload.NewCharacter) {
    const characterBefore = await getLatestCharacterByName(
      user.id,
      payload.Name
    );

    if (characterBefore) {
      const [
        itemsBefore,
        questsBefore,
        superUniquesBefore,
      ] = await Promise.all([
        await db.query(
          `SELECT item_id, item_hash, container, slot, x, y FROM character_items WHERE character_id=$1`,
          [characterBefore.id]
        ),
        await db.query(
          `SELECT difficulty, quest_id FROM quests WHERE character_id=$1`,
          [characterBefore.id]
        ),
        await db.query(
          `SELECT difficulty, monster_id FROM super_uniques WHERE character_id=$1`,
          [characterBefore.id]
        ),
      ]);

      before = {
        character: characterBefore,
        items: itemsBefore.rows,
        quests: questsBefore.rows,
        superUniques: superUniquesBefore.rows,
      };
    }
  }

  // Get active inventory tab and difficulty
  let inventoryTab = before ? before.character.inventory_tab : 0;

  if (payload.InventoryTab !== undefined) {
    inventoryTab = payload.InventoryTab;
  }

  // Get updates
  const questUpdates = getQuestUpdates(time, payload, before);
  const characterUpdates = getCharacterUpdates(
    time,
    payload,
    questUpdates,
    before
  );
  const itemUpdates = getItemUpdates(
    time,
    payload,
    inventoryTab,
    characterUpdates,
    before
  );

  // Save updates
  let characterId: number;

  if (before) {
    characterId = before.character.id;
    await saveCharacterUpdates(characterId, characterUpdates);
  } else {
    const updatedKeys = Object.keys(characterUpdates) as (keyof Character)[];
    const result = await db.query(
      `
          INSERT INTO characters (user_id, name, ${updatedKeys})
          VALUES ($1, $2, ${updatedKeys.map((_, i) => `$${3 + i}`)})
          RETURNING id
        `,
      [
        user.id,
        payload.Name,
        ...updatedKeys.map((key) => characterUpdates[key]),
      ]
    );

    characterId = result.rows[0].id;
  }

  await saveQuestUpdates(characterId, questUpdates);
  await saveItemUpdates(characterId, itemUpdates);

  // Join ladder if new character
  if (payload.NewCharacter && !before) {
    const ladder = await getCurrentLadder();

    if (ladder) {
      await db.query("UPDATE characters SET ladder_id=$2 WHERE id=$1", [
        characterId,
        ladder.id,
      ]);
    }
  }

  /*
    // When a new character is created, join public races where entry conditions are fulfilled
    if (!before && payload.Experience === 0) {
        const races = await getRacesForCharacterEntry(characterUpdates);

        await db.query(sqlFormat(
            'INSERT INTO race_characters (race_id, character_id, start_time, update_time) VALUES %L',
            races.map(race => [race.id, characterId, time, time])
        ));
    }
    */

  // Check command line args to join race
  if (
    !before &&
    race &&
    race.start_time &&
    race.start_time <= time &&
    (!race.finish_time || time < race.finish_time)
  ) {
    await joinRace(time, characterId, race);
  }

  // Check race updates
  const raceUpdates = await getRaceUpdates(
    time,
    characterId,
    characterUpdates,
    questUpdates,
    payload
  );

  await saveRaceUpdates(characterId, raceUpdates);

  // Broadcast updates
  await broadcast(`user/${user.name.toLowerCase()}`, {
    action: "update_character",
    id: characterId,
    name: payload.Name,
    characterUpdates,
    itemUpdates,
    questUpdates,
    raceUpdates: [],
  });

  for (const {
    raceId,
    raceCharacterUpdates,
    removeCheckpoints,
    addCheckpoints,
  } of raceUpdates) {
    await broadcast(`race/${raceId}`, {
      action: "update_race_character",
      user,
      raceId,
      characterId,
      characterName: payload.Name,
      raceCharacterUpdates: { ...characterUpdates, ...raceCharacterUpdates },
      removeCheckpoints,
      addCheckpoints,
    });
  }

  return `https://diablo.run/${user.name}/@`;
}
