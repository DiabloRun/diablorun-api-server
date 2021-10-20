export interface User {
  id: number;
  login: string;
  name: string;
  country_code: string;
  color: string;
  profile_image_url: string;
}

export interface Character {
  id: number;
  name: string;
  hero: "ama" | "asn" | "nec" | "bar" | "pal" | "sor" | "dru";
  hc: boolean;
  dead: boolean;

  level: number;
  experience: number;
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;

  fire_res: number;
  cold_res: number;
  light_res: number;
  poison_res: number;

  fcr: number;
  frw: number;
  fhr: number;
  ias: number;
  mf: number;

  gold: number;
  gold_stash: number;
  gold_total: number;
  inventory_tab: number;

  life: number;
  life_max: number;
  mana: number;
  mana_max: number;

  area: number;
  difficulty: "normal" | "nightmare" | "hell";
  players: number;

  // computed stats
  start_time: number;
  update_time: number;
  in_game_time: number;
  seconds_played: number;

  deaths: number;
  town_visits: number;

  total_kills: number;
  undead_kills: number;
  demon_kills: number;
  unique_kills: number;
  champion_kills: number;
  animal_kills: number;

  finished_normal_quests: number;
  finished_nightmare_quests: number;
  finished_hell_quests: number;

  // race stats
  race_id: number;
  points: number;
  disqualified: boolean;
  preliminary: boolean;
  finish_time: number | null;
  ladder_id: number | null;

  // hireling stats
  hireling_name: string | null;
  hireling_class: number | null;
  hireling_level: number | null;
  hireling_experience: number | null;
  hireling_strength: number | null;
  hireling_dexterity: number | null;
  hireling_fire_res: number | null;
  hireling_cold_res: number | null;
  hireling_light_res: number | null;
  hireling_poison_res: number | null;
  hireling_skill_ids: string | null;

  // system
  lod: boolean;
  seed: number;
  seed_is_arg: boolean;

  // process
  d2_mod: string;
  d2_version: string;
  d2_args: string;

  // user info
  user_id: number;
  user_name: string;
  user_country_code: string;
  user_color: string;
  user_profile_image_url: string;
}

export interface CharacterQuest {
  character_id: number;
  difficulty: Character["difficulty"];
  quest_id: number;
  update_time: number;
}

export interface CharacterItem {
  character_id: number;
  item_id: number;
  item_hash: number;
  update_time: number;

  item_class: number;
  name: string;
  base_name: string;
  quality: "white" | "blue" | "yellow" | "orange" | "gold" | "green" | "none";
  properties: string;

  container: "character" | "hireling" | "inventory" | "stash" | "cube" | "belt";
  slot:
    | "head"
    | "amulet"
    | "body_armor"
    | "primary_left"
    | "primary_right"
    | "ring_left"
    | "ring_right"
    | "belt"
    | "boots"
    | "gloves"
    | "secondary_left"
    | "secondary_right"
    | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
}

export interface D2rItem {
  id: number;
  user_id: number;
  container: CharacterItem["container"];
  slot: CharacterItem["slot"];
  update_time: number;
  item_jpg: Blob;
  item_description: Blob;
}

export interface CharacterSnapshot {
  character: Character;
  quests: CharacterQuest[];
  items: CharacterItem[];
  races?: Race[];
}

export interface Race {
  id: number;
  name: string;
}

export interface RaceRule {
  id: number;
  race_id: number;
  context: "points" | "finish_conditions";
  amount: number;
  type: "quest" | "per" | "for";
  counter: number;
  stat: keyof Character;
  difficulty: Character["difficulty"];
  quest_id: number;
  time_type: "race" | "state";
  time_seconds: number;
  claimed: boolean;
}

export interface RaceCharacter {
  race_id: number;
  character_id: number;
  start_time: number;
  update_time: number;
  finish_time: number | null;
  points: number;
}

export interface RaceCharacterCheckpoint {
  race_id: number;
  character_id: number;
  rule_id: number;
  update_time: number;
  points: number;
}

export interface SpeedrunCategory {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  precedence: number;
  px_only: boolean;
}

export interface Speedrun {
  run_time: number;
  submit_time: number;
  seconds_played: number;

  category_id: number;
  players_category: "p1" | "px" | "p8";
  hc: boolean;
  hero: Character["hero"];
  character_id: number | null;

  speedrun_offset: number | null;
  speedrun_id: string | null;
  speedrun_link: string | null;
  speedrun_user_id: string | null;
}

export interface SpeedrunUser {
  id: string;
  user_id: number | null;
  name: string;
  weblink: string;
  light_color_from: string;
  light_color_to: string;
  dark_color_from: string;
  dark_color_to: string;
  country_code: string | null;
  twitch: string | null;
  hitbox: string | null;
  youtube: string | null;
  twitter: string | null;
  speedrunslive: string | null;
}

export interface SpeedrunComUserResponse {
  data: {
    id: string;
    weblink: string;

    names: {
      international: string;
    };

    "name-style": {
      style: "solid" | "gradient";
      color?: {
        light: string;
        dark: string;
      };
      "color-from"?: {
        light: string;
        dark: string;
      };
      "color-to"?: {
        light: string;
        dark: string;
      };
    };

    location?: {
      country: {
        code: string;
      };
    };

    twitch?: {
      uri: string;
    };

    hitbox?: {
      uri: string;
    };

    youtube?: {
      uri: string;
    };

    twitter?: {
      uri: string;
    };

    speedrunslive?: {
      uri: string;
    };
  };
}

export interface SpeedrunComRun {
  id: string;
  weblink: string;
  date: string;
  submitted: string;
  comment: string | null;

  players: {
    rel: "user" | "guest";
    id: string;
  }[];

  times: {
    primary_t: number;
    realtime_t: number;
    realtime_noloads_t: number;
    ingame_t: number;
  };

  category:
    | "jdzepoxd"
    | "02q987zk"
    | "824lm93d"
    | "9d8ojnq2"
    | "xd113q8d"
    | "zd3vlrn2"
    | "9d84mq6k"
    | "7kj3my42"
    | "5dw89pgd"
    | "w20g1v5k";
  values: {
    gnxj216l?: "gq70xjnl" | "21gvp8x1";
    ylq6ow38?:
      | "p12r0m7l"
      | "81pv5og1"
      | "xqk2n0nq"
      | "gq70xjvl"
      | "21gvp8n1"
      | "jqz83pgq"
      | "klrv2pjq";
    "2lgrgren"?:
      | "21gyvdo1"
      | "4lx3rpgl"
      | "81438ykq"
      | "5led9jm1"
      | "xqk7y4yl"
      | "4lx3jngl"
      | "814e4vkl"
      | "p12em571"
      | "klr4wkoq";
    "0nw709d8"?: "klrvr40q" | "21d9mg3q";
    p854347l?: "0q5kynvq" | "4lx3703l";
    e8mmz2x8?: "klryrn2q" | "81wrepml";
  };
}

export interface SpeedrunComRunsResponse {
  data: SpeedrunComRun[];
  pagination: {
    offset: number;
    max: number;
    size: number;
    links: {
      rel: "next";
      uri: string;
    }[];
  };
}

export interface Ladder {
  id: number;
  start_time: number;
  end_time: number;
  stat: keyof Character;
}

export interface Bounty {
  id: number;
  name: string;
  description: string;
  reward: string | null;
  prepaid: boolean | null;
  expiration: number | null;

  author_user: User;

  claimed_character: {
    id: Character["id"];
    name: Character["name"];
    hero: Character["hero"];
    hc: Character["hc"];

    user_id: User["id"];
    user_name: User["name"];
    user_country_code: User["country_code"];
    user_color: User["color"];
    user_profile_image_url: User["profile_image_url"];
  } | null;
}
