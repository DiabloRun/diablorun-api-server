import { D2rItem } from "src/types";
import db from "../services/db";

export async function updateD2rItem(
  userId: number,
  container: D2rItem["container"],
  slot: D2rItem["slot"],
  itemJpg: Buffer | null,
  descriptionJpg: Buffer | null
) {
  const time = Math.floor(Date.now() / 1000);

  await db.query(
    `INSERT INTO d2r_items (
      user_id, session_id, container, slot, update_time, item_jpg, description_jpg
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, session_id, container, slot)
    DO UPDATE SET update_time=$5, item_jpg=COALESCE($6, d2r_items.item_jpg), description_jpg=COALESCE($7, d2r_items.description_jpg)`,
    [userId, 1, container, slot, time, itemJpg, descriptionJpg]
  );

  /*
  const {
    rows,
  } = await db.query(
    `SELECT id FROM d2r_items WHERE user_id=$1 AND container=$2 AND slot=$3 ORDER BY update_time DESC LIMIT 1`,
    [userId, container, slot]
  );

  if (!rows.length) {
    await db.query(
      `INSERT INTO d2r_items (user_id, container, slot, update_time, item_jpg, description_jpg) VALUES (
        $1, $2, $3, $4, $5, $6)`,
      [userId, container, slot, time, itemJpg, descriptionJpg]
    );
    return;
  }

  const id = rows[0].id;

  if (itemJpg && descriptionJpg) {
    await db.query(
      `UPDATE d2r_items SET update_time=$2, item_jpg=$3, description_jpg=$4 WHERE id=$1`,
      [id, time, itemJpg, descriptionJpg]
    );
  } else if (itemJpg) {
    await db.query(
      `UPDATE d2r_items SET update_time=$2, item_jpg=$3 WHERE id=$1`,
      [id, time, itemJpg]
    );
  } else if (descriptionJpg) {
    await db.query(
      `UPDATE d2r_items SET update_time=$2, description_jpg=$3 WHERE id=$1`,
      [id, time, descriptionJpg]
    );
  }
  */
}

export async function removeD2rItem(
  userId: number,
  container: D2rItem["container"],
  slot: D2rItem["slot"]
) {
  await db.query(
    `DELETE FROM d2r_items WHERE user_id=$1 AND container=$2 AND slot=$3`,
    [userId, container, slot]
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
