import { CharacterSuperUnique, CharacterSnapshot } from "../types";
import { Payload } from "./payload";
import db from "../services/db";
import { difficulties } from "@diablorun/diablorun-data";

export function getSuperUniqueUpdates(
  time: number,
  payload: Payload,
  before?: CharacterSnapshot
) {
  const superUniqueUpdates: Partial<CharacterSuperUnique>[] = [];
  const killedSuperUniques = (payload.KilledMonsters ?? []).filter(
    (kill) => kill.TypeFlags & 0x00000002
  );

  if (!killedSuperUniques.length) {
    return superUniqueUpdates;
  }

  const difficulty = (payload.Difficulty !== undefined
    ? difficulties[payload.Difficulty]
    : before?.character.difficulty) as CharacterSuperUnique["difficulty"];
  const previouslyKilledSuperUniques = before ? before.superUniques : [];

  for (const kill of killedSuperUniques) {
    if (
      !previouslyKilledSuperUniques.find(
        (k) => k.difficulty === difficulty && k.monster_id === kill.Class
      )
    ) {
      superUniqueUpdates.push({
        update_time: time,
        difficulty,
        monster_id: kill.Class,
      });
    }
  }

  return superUniqueUpdates;
}

export async function saveSuperUniqueUpdates(
  characterId: number,
  updates: Partial<CharacterSuperUnique>[]
) {
  if (!updates.length) {
    return;
  }

  await db.query(
    `
        INSERT INTO super_uniques (character_id, difficulty, monster_id, update_time) VALUES
        ${updates.map(
          (_, i) =>
            `($${4 * i + 1}, $${4 * i + 2}, $${4 * i + 3}, $${4 * i + 4})`
        )}
    `,
    Array.prototype.concat(
      ...updates.map(({ update_time, difficulty, monster_id }) => [
        characterId,
        difficulty,
        monster_id,
        update_time,
      ])
    )
  );
}
