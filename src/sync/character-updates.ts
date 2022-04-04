import {
  Character,
  CharacterQuest,
  CharacterSnapshot,
  CharacterSuperUnique,
} from "../types";
import { Payload } from "./payload";
import db from "../services/db";
import { heroes, areas, difficulties } from "@diablorun/diablorun-data";

export function getCharacterUpdates(
  time: number,
  payload: Payload,
  questUpdates: Partial<CharacterQuest>[],
  superUniqueUpdates: Partial<CharacterSuperUnique>[],
  before?: CharacterSnapshot
) {
  const updates: Partial<Character> = {};
  const character = before?.character;

  // Start and update times
  if (!character) {
    updates.start_time = time;
  }

  updates.update_time = time;

  // Simple stats
  if (payload.Area !== undefined) updates.area = payload.Area;
  if (payload.Difficulty !== undefined)
    updates.difficulty = difficulties[payload.Difficulty] as any;
  if (payload.PlayersX !== undefined) updates.players = payload.PlayersX;
  if (payload.CharClass !== undefined)
    updates.hero = heroes[payload.CharClass].id as any;
  if (payload.IsHardcore !== undefined) updates.hc = payload.IsHardcore;
  if (payload.IsExpansion !== undefined) updates.lod = payload.IsExpansion;
  if (payload.IsDead !== undefined) updates.dead = payload.IsDead;
  if (payload.Deaths !== undefined) updates.deaths = payload.Deaths;
  if (payload.Level !== undefined) updates.level = payload.Level;

  if (payload.Experience !== undefined) {
    updates.experience =
      payload.Experience < 0
        ? payload.Experience + Math.pow(2, 32)
        : payload.Experience;
  }

  if (payload.Strength !== undefined) updates.strength = payload.Strength;
  if (payload.Dexterity !== undefined) updates.dexterity = payload.Dexterity;
  if (payload.Vitality !== undefined) updates.vitality = payload.Vitality;
  if (payload.Energy !== undefined) updates.energy = payload.Energy;
  if (payload.FireResist !== undefined) updates.fire_res = payload.FireResist;
  if (payload.ColdResist !== undefined) updates.cold_res = payload.ColdResist;
  if (payload.LightningResist !== undefined)
    updates.light_res = payload.LightningResist;
  if (payload.PoisonResist !== undefined)
    updates.poison_res = payload.PoisonResist;
  if (payload.FasterCastRate !== undefined)
    updates.fcr = payload.FasterCastRate;
  if (payload.FasterRunWalk !== undefined) updates.frw = payload.FasterRunWalk;
  if (payload.FasterHitRecovery !== undefined)
    updates.fhr = payload.FasterHitRecovery;
  if (payload.IncreasedAttackSpeed !== undefined)
    updates.ias = payload.IncreasedAttackSpeed;
  if (payload.MagicFind !== undefined) updates.mf = payload.MagicFind;
  if (payload.Life !== undefined) updates.life = payload.Life;
  if (payload.LifeMax !== undefined) updates.life_max = payload.LifeMax;
  if (payload.Mana !== undefined) updates.mana = payload.Mana;
  if (payload.ManaMax !== undefined) updates.mana_max = payload.ManaMax;
  if (payload.Seed !== undefined) updates.seed = payload.Seed;
  if (payload.SeedIsArg !== undefined) updates.seed_is_arg = payload.SeedIsArg;
  if (payload.InventoryTab !== undefined)
    updates.inventory_tab = payload.InventoryTab;

  // Gold
  if (payload.Gold !== undefined) updates.gold = payload.Gold;
  if (payload.GoldStash !== undefined) updates.gold_stash = payload.GoldStash;

  if (payload.Gold !== undefined || payload.GoldStash !== undefined) {
    updates.gold_total = 0;
    updates.gold_total +=
      payload.Gold === undefined
        ? character
          ? character.gold
          : 0
        : payload.Gold;
    updates.gold_total +=
      payload.GoldStash === undefined
        ? character
          ? character.gold_stash
          : 0
        : payload.GoldStash;
  }

  // Hireling stats
  if (payload.Hireling) {
    if (payload.Hireling.Name !== undefined)
      updates.hireling_name = payload.Hireling.Name;
    if (payload.Hireling.Class !== undefined)
      updates.hireling_class = payload.Hireling.Class;
    if (payload.Hireling.Level !== undefined)
      updates.hireling_level = payload.Hireling.Level;

    if (payload.Hireling.Experience !== undefined) {
      updates.hireling_experience =
        payload.Hireling.Experience < 0
          ? payload.Hireling.Experience + Math.pow(2, 32)
          : payload.Hireling.Experience;
    }

    if (payload.Hireling.Strength !== undefined)
      updates.hireling_strength = payload.Hireling.Strength;
    if (payload.Hireling.Dexterity !== undefined)
      updates.hireling_dexterity = payload.Hireling.Dexterity;
    if (payload.Hireling.FireResist !== undefined)
      updates.hireling_fire_res = payload.Hireling.FireResist;
    if (payload.Hireling.ColdResist !== undefined)
      updates.hireling_cold_res = payload.Hireling.ColdResist;
    if (payload.Hireling.LightningResist !== undefined)
      updates.hireling_light_res = payload.Hireling.LightningResist;
    if (payload.Hireling.PoisonResist !== undefined)
      updates.hireling_poison_res = payload.Hireling.PoisonResist;
    if (payload.Hireling.SkillIds !== undefined)
      updates.hireling_skill_ids = JSON.stringify(payload.Hireling.SkillIds);
  }

  // Play time counters
  if (!character) {
    updates.seconds_played = 0;
  } else if (character.finish_time && character.finish_time < time) {
    updates.seconds_played = character.finish_time - character.start_time;
  } else {
    updates.seconds_played = time - character.start_time;
  }

  if (!character) {
    updates.in_game_time = 0;
  } else {
    const timeDiff = time - character.update_time;

    if (timeDiff < 60) {
      updates.in_game_time = character.in_game_time + timeDiff;
    }
  }

  // Town visit counter
  if (!character) {
    updates.town_visits = 1;
  } else if (
    payload.Area &&
    !(areas[character.area] && areas[character.area].town) &&
    areas[payload.Area] &&
    areas[payload.Area].town
  ) {
    updates.town_visits = character.town_visits + 1;
  }

  // Kill counters
  if (payload.KilledMonsters) {
    const totalKillsCount = payload.KilledMonsters.length;
    const animalKillsCount = payload.KilledMonsters.filter((m) => m.Type == 0)
      .length;
    const demonKillsCount = payload.KilledMonsters.filter((m) => m.Type == 1)
      .length;
    const undeadKillsCount = payload.KilledMonsters.filter((m) => m.Type == 2)
      .length;
    const championKillsCount = payload.KilledMonsters.filter(
      (m) => m.TypeFlags & 0x00000004
    ).length;
    const uniqueKillsCount = payload.KilledMonsters.filter(
      (m) => m.TypeFlags & 0x00000008
    ).length;

    if (totalKillsCount)
      updates.total_kills =
        (character ? character.total_kills : 0) + totalKillsCount;
    if (animalKillsCount)
      updates.animal_kills =
        (character ? character.animal_kills : 0) + animalKillsCount;
    if (demonKillsCount)
      updates.demon_kills =
        (character ? character.demon_kills : 0) + demonKillsCount;
    if (undeadKillsCount)
      updates.undead_kills =
        (character ? character.undead_kills : 0) + undeadKillsCount;
    if (championKillsCount)
      updates.champion_kills =
        (character ? character.champion_kills : 0) + championKillsCount;
    if (uniqueKillsCount)
      updates.unique_kills =
        (character ? character.unique_kills : 0) + uniqueKillsCount;
  }

  // Quest counters
  if (questUpdates.length) {
    const normalCount = questUpdates.filter((q) => q.difficulty === "normal")
      .length;
    const nightmareCount = questUpdates.filter(
      (q) => q.difficulty === "nightmare"
    ).length;
    const hellCount = questUpdates.filter((q) => q.difficulty === "hell")
      .length;

    if (normalCount)
      updates.finished_normal_quests =
        (character?.finished_normal_quests ?? 0) + normalCount;
    if (nightmareCount)
      updates.finished_nightmare_quests =
        (character?.finished_nightmare_quests ?? 0) + nightmareCount;
    if (hellCount)
      updates.finished_hell_quests =
        (character?.finished_hell_quests ?? 0) + hellCount;
  }

  // Super unique counters
  if (superUniqueUpdates.length) {
    const normalCount = superUniqueUpdates.filter(
      (q) => q.difficulty === "normal"
    ).length;
    const nightmareCount = superUniqueUpdates.filter(
      (q) => q.difficulty === "nightmare"
    ).length;
    const hellCount = superUniqueUpdates.filter((q) => q.difficulty === "hell")
      .length;

    if (normalCount)
      updates.normal_super_uniques =
        (character?.normal_super_uniques ?? 0) + normalCount;
    if (nightmareCount)
      updates.nightmare_super_uniques =
        (character?.nightmare_super_uniques ?? 0) + nightmareCount;
    if (hellCount)
      updates.hell_super_uniques =
        (character?.hell_super_uniques ?? 0) + hellCount;
  }

  // D2 process
  if (payload.D2ProcessInfo) {
    updates.d2_mod = payload.D2ProcessInfo.Type;
    updates.d2_version = payload.D2ProcessInfo.Version;
    updates.d2_args = payload.D2ProcessInfo.CommandLineArgs.join(" ");
  }

  return updates;
}

export async function saveCharacterUpdates(
  characterId: number,
  updates: Partial<Character>
) {
  const updatedKeys = Object.keys(updates) as (keyof Character)[];

  await db.query(
    `
    UPDATE characters SET ${updatedKeys.map((key, i) => `${key}=$${1 + i}`)}
    WHERE id=$${updatedKeys.length + 1}
  `,
    [...updatedKeys.map((key) => updates[key]), characterId]
  );

  await db.query(
    `
    INSERT INTO characters_log
    SELECT
      id AS character_id,
      (update_time - update_time % 10) AS update_time,
      seconds_played, in_game_time,
      level, experience, strength, dexterity, vitality, energy,
      fire_res, cold_res, light_res, poison_res,
      gold, gold_stash, life, life_max, mana, mana_max,
      seed, seed_is_arg, inventory_tab,
      hireling_name, hireling_class,
      hireling_level, hireling_experience,
      hireling_strength, hireling_dexterity,
      hireling_fire_res, hireling_cold_res, hireling_light_res, hireling_poison_res,
      hireling_skill_ids,
      area, difficulty, players, deaths,
      fcr, frw, fhr, ias, mf, gold_total, town_visits,
      finished_normal_quests, finished_nightmare_quests, finished_hell_quests,
      total_kills, animal_kills, undead_kills, demon_kills, champion_kills, unique_kills
    FROM characters WHERE id=$1
    ON CONFLICT DO NOTHING
  `,
    [characterId]
  );
}
