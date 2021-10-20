import { D2rItem } from "src/types";
import db from "../services/db";

export async function updateD2rItem(
  userId: number,
  container: D2rItem["container"],
  slot: D2rItem["slot"],
  itemJpg: Buffer,
  descriptionJpg: Buffer
) {
  const time = Math.floor(Date.now() / 1000);

  await db.query(
    `INSERT INTO d2r_items (user_id, container, slot, update_time, item_jpg, description_jpg) VALUES (
      $1, $2, $3, $4, $5, $6)`,
    [userId, container, slot, time, itemJpg, descriptionJpg]
  );
}

export async function getD2rItemJpg(
  userId: number,
  container: D2rItem["container"],
  slot: D2rItem["slot"]
): Promise<Buffer | null> {
  const {
    rows,
  } = await db.query(
    `SELECT item_jpg FROM d2r_items WHERE user_id=$1 AND container=$2 AND slot=$3 ORDER BY update_time DESC LIMIT 1`,
    [userId, container, slot]
  );

  return rows.length ? rows[0].item_jpg : null;
}

export async function getD2rItemDescriptionJpg(
  userId: number,
  container: D2rItem["container"],
  slot: D2rItem["slot"]
): Promise<Buffer | null> {
  const {
    rows,
  } = await db.query(
    `SELECT description_jpg FROM d2r_items WHERE user_id=$1 AND container=$2 AND slot=$3 ORDER BY update_time DESC LIMIT 1`,
    [userId, container, slot]
  );

  return rows.length ? rows[0].description_jpg : null;
}
