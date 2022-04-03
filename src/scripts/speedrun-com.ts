import fetch from "node-fetch";
import db from "../services/db";
import * as sqlFormat from "pg-format";
import {
  Character,
  Speedrun,
  SpeedrunUser,
  SpeedrunComUserResponse,
  SpeedrunComRun,
  SpeedrunComRunsResponse,
} from "../types";

export const gameId = "yd4opx1e"; // Diablo II: Lord of Destruction

export function getCategoryId({ category }: SpeedrunComRun): number {
  if (category === "7kj3my42") {
    return 5; // Seeded Hell
  }

  if (category == "9d84mq6k") {
    return 4; // Seeded Normal
  }

  if (category === "5dw89pgd") {
    return 3; // Pacifist
  }

  if (
    category === "9d8ojnq2" ||
    category === "xd113q8d" ||
    category === "zd3vlrn2"
  ) {
    return 2; // Hell
  }

  return 1; // Normal
}

export function isHC({ values }: SpeedrunComRun) {
  return values["gnxj216l"] === "21gvp8x1";
}

export function getPlayersCategory({
  category,
}: SpeedrunComRun): Speedrun["players_category"] {
  if (category === "jdzepoxd" || category === "9d8ojnq2") {
    return "p1";
  }

  if (category === "824lm93d" || category === "zd3vlrn2") {
    return "p8";
  }

  return "px";
}

export function getHero({ values }: SpeedrunComRun): Character["hero"] | null {
  switch (values["ylq6ow38"]) {
    case "p12r0m7l":
      return "ama";
    case "81pv5og1":
      return "asn";
    case "xqk2n0nq":
      return "bar";
    case "gq70xjvl":
      return "dru";
    case "21gvp8n1":
      return "nec";
    case "jqz83pgq":
      return "pal";
    case "klrv2pjq":
      return "sor";
  }

  return null;
}

export function getCharacterId(run: SpeedrunComRun) {
  const match = (run.comment || "").match(/diablo\.run\/.*?\/.*?(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

export async function fetchRuns(
  offset: number = 0
): Promise<{ data: Speedrun[]; more: boolean; nextOffset: number }> {
  const uri = `https://www.speedrun.com/api/v1/runs?game=${gameId}&status=verified&orderby=verify-date&direction=asc&offset=${offset}`;
  const res = await fetch(uri);
  const { data, pagination }: SpeedrunComRunsResponse = await res.json();
  const speedruns: Speedrun[] = [];

  data.forEach((run, index) => {
    const hero = getHero(run);

    if (!hero) {
      return;
    }

    speedruns.push({
      run_time: Math.floor(new Date(run.date).getTime() / 1000),
      submit_time: Math.floor(new Date(run.submitted).getTime() / 1000),
      seconds_played: run.times.ingame_t,

      category_id: getCategoryId(run),
      players_category: getPlayersCategory(run),
      hc: isHC(run),
      hero,
      character_id: getCharacterId(run),

      speedrun_offset: offset + index,
      speedrun_id: run.id,
      speedrun_link: run.weblink,
      speedrun_user_id: run.players
        .filter((player) => player.rel === "user")
        .map((user) => user.id)
        .join(","),
    });
  });

  return {
    data: speedruns,
    more: !!pagination.links.find((link) => link.rel === "next"),
    nextOffset: offset + pagination.size,
  };
}

export async function fetchUsers(userIds: string[]): Promise<SpeedrunUser[]> {
  const speedrunUsers: SpeedrunUser[] = [];
  const twitchUsernamesMap: { [username: string]: SpeedrunUser[] } = {};

  // Fetch speedrun.com users
  await Promise.all(
    userIds.map(async (id) => {
      try {
        await new Promise<void>((r) => setTimeout(r, Math.random() * 60000));
        console.log(`[INFO] Fetching speedrun.com user ${id}...`);

        const res = await fetch(`https://www.speedrun.com/api/v1/users/${id}`);
        const { data }: SpeedrunComUserResponse = await res.json();
        const speedrunUser = {
          id: data.id,
          user_id: null,
          name: data.names.international,
          weblink: data.weblink,
          light_color_from:
            data["name-style"].style === "solid"
              ? data["name-style"].color!.light
              : data["name-style"]["color-from"]!.light,
          light_color_to:
            data["name-style"].style === "solid"
              ? data["name-style"].color!.light
              : data["name-style"]["color-to"]!.light,
          dark_color_from:
            data["name-style"].style === "solid"
              ? data["name-style"].color!.dark
              : data["name-style"]["color-from"]!.dark,
          dark_color_to:
            data["name-style"].style === "solid"
              ? data["name-style"].color!.dark
              : data["name-style"]["color-to"]!.dark,
          country_code: data.location ? data.location.country.code : null,
          twitch: data.twitch ? data.twitch.uri : null,
          hitbox: data.hitbox ? data.hitbox.uri : null,
          youtube: data.youtube ? data.youtube.uri : null,
          twitter: data.twitter ? data.twitter.uri : null,
          speedrunslive: data.speedrunslive ? data.speedrunslive.uri : null,
        };

        if (data.twitch) {
          const match = data.twitch.uri.match(/twitch\.tv\/(.*?)\/?$/);

          if (match) {
            const username = match[1].toLowerCase();

            if (username in twitchUsernamesMap) {
              twitchUsernamesMap[username].push(speedrunUser);
            } else {
              twitchUsernamesMap[username] = [speedrunUser];
            }
          }
        }

        speedrunUsers.push(speedrunUser);
      } catch (err) {
        console.log(`user ${id} not found`);
      }
    })
  );

  // Fetch diablo.run users by Twitch usernames
  const twitchUsernames = Object.keys(twitchUsernamesMap);

  if (twitchUsernames.length) {
    const users = await db.query(
      sqlFormat(
        `
            SELECT id, login FROM users WHERE login IN (%L)
        `,
        twitchUsernames
      )
    );

    for (const user of users.rows) {
      for (const speedrunUser of twitchUsernamesMap[user.login]) {
        speedrunUser.user_id = user.id;
      }
    }
  }

  return speedrunUsers;
}
