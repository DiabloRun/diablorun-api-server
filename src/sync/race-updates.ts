import {
  Character,
  CharacterQuest,
  Race,
  RaceCharacter,
  RaceCharacterCheckpoint,
} from "../types";
import db from "../services/db";
import * as sqlFormat from "pg-format";
import {
  findRaceCharacterCheckpoints,
  findRaceCharacters,
  findRaceRules,
} from "../collections/races";

interface RaceUpdate {
  raceId: number;
  raceCharacterUpdates: Partial<RaceCharacter>;
  removeCheckpoints: number[];
  addCheckpoints: RaceCharacterCheckpoint[];
}

export async function joinRaceByArgs(
  time: number,
  characterId: number,
  d2_args: string
) {
  const raceTokenMatch = d2_args.match(/-race([\w-]+)/);

  if (raceTokenMatch) {
    const token = raceTokenMatch[1];
    const raceQuery = await db.query(
      `SELECT id, finish_time FROM races WHERE token=$1 AND (finish_time IS NULL OR finish_time<$2)`,
      [token, time]
    );

    if (raceQuery.rows.length) {
      const race = raceQuery.rows[0] as Race;

      await db.query(
        "INSERT INTO race_characters (race_id, character_id, start_time, update_time, finish_time) VALUES ($1, $2, $3, $3, $4)",
        [race.id, characterId, time, race.finish_time]
      );
    }
  }
}

export async function getRaceUpdates(
  time: number,
  characterId: number,
  characterUpdates: Partial<Character>,
  questUpdates: Partial<CharacterQuest>[]
): Promise<RaceUpdate[]> {
  const raceCharacters = await findRaceCharacters(
    sqlFormat(
      "SELECT * FROM race_characters WHERE character_id=%L AND finish_time IS NULL",
      characterId
    )
  );

  if (!raceCharacters.length) {
    return [];
  }

  // Find race rules that should be re-checked by stat and quest updates
  const findRules = [];
  const updatedStats = Object.keys(characterUpdates);

  if (updatedStats.length) {
    findRules.push(sqlFormat(`(type='per' AND stat IN (%L))`, updatedStats));
  }

  if (questUpdates.length) {
    for (const quest of questUpdates) {
      findRules.push(
        sqlFormat(
          `(type='quest' AND difficulty=%L AND quest_id=%L)`,
          quest.difficulty,
          quest.quest_id
        )
      );
    }
  }

  // Get checkpoint updates
  const checkpointUpdates: RaceCharacterCheckpoint[] = [];
  const raceFinishedUpdates = [];

  if (findRules.length) {
    const rules = await findRaceRules(
      sqlFormat(
        `SELECT * FROM race_rules WHERE race_id IN (%L) AND (${findRules.join(
          " OR "
        )})`,
        raceCharacters.map((rc) => rc.race_id)
      )
    );

    for (const rule of rules) {
      if (rule.type === "quest") {
        checkpointUpdates.push({
          race_id: rule.race_id,
          character_id: characterId,
          rule_id: rule.id,
          update_time: time,
          points: rule.amount,
        });
      } else if (rule.type === "per") {
        checkpointUpdates.push({
          race_id: rule.race_id,
          character_id: characterId,
          rule_id: rule.id,
          update_time: time,
          points: rule.amount * (characterUpdates[rule.stat] as number),
        });
      }

      if (rule.context === "finish_conditions") {
        raceFinishedUpdates.push(rule.race_id);
      }
    }
  }

  // Get race character updates
  const raceUpdates: RaceUpdate[] = [];

  if (checkpointUpdates.length) {
    const previousCheckpoints = await findRaceCharacterCheckpoints(
      sqlFormat(
        `SELECT rule_id, points FROM character_checkpoints WHERE character_id=%L AND rule_id IN (%L)`,
        characterId,
        checkpointUpdates.map((checkpoint) => checkpoint.rule_id)
      )
    );

    for (const raceCharacter of raceCharacters) {
      const addCheckpoints = [];
      const removeCheckpoints = [];
      const raceCharacterUpdates: Partial<RaceCharacter> = {
        update_time: time,
        points: Number(raceCharacter.points),
      };

      for (const checkpoint of checkpointUpdates) {
        if (checkpoint.race_id !== raceCharacter.race_id) {
          continue;
        }

        // Find previous checkpoint for same rule
        const previousCheckpoint = previousCheckpoints.find(
          (c) => c.rule_id === checkpoint.rule_id
        );

        if (previousCheckpoint) {
          // Do not update checkpoint if points are same
          if (previousCheckpoint.points === checkpoint.points) {
            continue;
          }

          removeCheckpoints.push(previousCheckpoint.rule_id);
          raceCharacterUpdates.points! -= previousCheckpoint.points;
        }

        // Add points for checkpoint
        addCheckpoints.push(checkpoint);
        raceCharacterUpdates.points! += checkpoint.points;
      }

      if (addCheckpoints.length) {
        if (raceFinishedUpdates.includes(raceCharacter.race_id)) {
          raceCharacterUpdates.finish_time = time;
        }

        raceUpdates.push({
          raceId: raceCharacter.race_id,
          raceCharacterUpdates,
          removeCheckpoints,
          addCheckpoints,
        });
      }
    }
  }

  // Force race character broadcast if certain stats are updated
  if (
    updatedStats.includes("gold_total") ||
    updatedStats.includes("area") ||
    updatedStats.includes("deaths") ||
    updatedStats.includes("level") ||
    updatedStats.includes("difficulty") ||
    updatedStats.includes("players")
  ) {
    for (const raceCharacter of raceCharacters) {
      if (
        raceUpdates.find(
          (raceUpdate) => raceUpdate.raceId === raceCharacter.race_id
        )
      ) {
        continue;
      }

      raceUpdates.push({
        raceId: raceCharacter.race_id,
        raceCharacterUpdates: {},
        removeCheckpoints: [],
        addCheckpoints: [],
      });
    }
  }

  return raceUpdates;
}

export async function saveRaceUpdates(
  characterId: number,
  updates: RaceUpdate[]
) {
  for (const {
    raceId,
    raceCharacterUpdates,
    removeCheckpoints,
    addCheckpoints,
  } of updates) {
    // Save race character updates
    const updatedKeys = Object.keys(
      raceCharacterUpdates
    ) as (keyof RaceCharacter)[];

    if (updatedKeys.length) {
      await db.query(
        sqlFormat(
          `UPDATE race_characters SET ${updatedKeys.map(
            (key) => `${key}=%L`
          )} WHERE race_id=%L AND character_id=%L`,
          ...updatedKeys.map((key) => raceCharacterUpdates[key]),
          raceId,
          characterId
        )
      );
    }

    // Remove changed checkpoints
    if (removeCheckpoints.length) {
      await db.query(
        sqlFormat(
          `DELETE FROM character_checkpoints WHERE character_id=%L AND rule_id IN (%L)`,
          characterId,
          removeCheckpoints
        )
      );
    }

    // Add new checkpoints
    if (addCheckpoints.length) {
      await db.query(
        sqlFormat(
          `INSERT INTO character_checkpoints (race_id, character_id, rule_id, update_time, points) VALUES %L`,
          addCheckpoints.map((c) => [
            raceId,
            characterId,
            c.rule_id,
            c.update_time,
            c.points,
          ])
        )
      );
    }
  }
}
