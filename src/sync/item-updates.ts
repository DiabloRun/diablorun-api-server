import { Character, CharacterItem, CharacterSnapshot } from "../types";
import { Payload, ItemPayload } from "./payload";
import db from "../services/db";
import { hash32 } from "farmhash";

interface ItemUpdates {
  removedItemHashes: number[];
  addedItems: Partial<CharacterItem>[];
}

function getItemContainer(location: number): CharacterItem["container"] {
  switch (location) {
    case 0:
      return "character";
    case 1:
      return "belt";
    case 2:
      return "inventory";
    case 5:
      return "cube";
    case 6:
      return "stash";
    case 10:
      return "hireling";
  }

  return "stash";
}

function getItemSlot(
  container: CharacterItem["container"],
  inventoryTab: number,
  location: number
): CharacterItem["slot"] {
  if (container !== "character" && container !== "hireling") {
    return null;
  }

  switch (location) {
    case 1:
      return "head";
    case 2:
      return "amulet";
    case 3:
      return "body_armor";
    case 4:
      return container !== "character" || !inventoryTab
        ? "primary_left"
        : "secondary_left";
    case 5:
      return container !== "character" || !inventoryTab
        ? "primary_right"
        : "secondary_right";
    case 6:
      return "ring_left";
    case 7:
      return "ring_right";
    case 8:
      return "belt";
    case 9:
      return "boots";
    case 10:
      return "gloves";
    case 11:
      return container !== "character" || !inventoryTab
        ? "secondary_left"
        : "primary_left";
    case 12:
      return container !== "character" || !inventoryTab
        ? "secondary_right"
        : "primary_right";
  }

  return null;
}

export function getItemUpdates(
  time: number,
  payload: Payload,
  inventoryTab: number,
  characterUpdates: Partial<Character>,
  before?: CharacterSnapshot
): ItemUpdates {
  // Get items before update
  const itemsBefore = before ? before.items : [];
  const itemsBeforeById: { [id: string]: CharacterItem } = {};
  const itemsBeforeByHash: { [hash: string]: CharacterItem } = {};

  for (const item of itemsBefore) {
    itemsBeforeById[item.item_id] = item;
    itemsBeforeByHash[item.item_hash] = item;
  }

  // Get removed item hashes
  const removedItemHashes = [];

  const removedItems = [
    ...(payload.RemovedItems || []),
    ...(payload.Hireling?.RemovedItems || []),
  ] as ItemPayload[];

  if (payload.ClearItems) {
    for (const item of itemsBefore) {
      removedItemHashes.push(Number(item.item_hash));
    }
  } else {
    for (const itemPayload of removedItems) {
      const container = getItemContainer(itemPayload.Location.Container);
      const slot = getItemSlot(
        container,
        inventoryTab,
        itemPayload.Location.BodyLocation
      );
      const x = itemPayload.Location.X;
      const y = itemPayload.Location.Y;

      const itemBefore = itemsBefore.find((item) => {
        if (item.container !== container) {
          return false;
        }

        if (container === "character" || container === "hireling") {
          return item.slot === slot;
        }

        return item.x === x && item.y === y;
      });

      if (itemBefore) {
        removedItemHashes.push(Number(itemBefore.item_hash));
      }
    }
  }

  // Add items
  const addedItems: Partial<CharacterItem>[] = [];
  const addedPayload = [
    ...(payload.AddedItems || []),
    ...(payload.Hireling?.Items || payload.Hireling?.AddedItems || []),
  ];

  for (const itemPayload of addedPayload) {
    const item_id = itemPayload.GUID;
    const container = getItemContainer(itemPayload.Location.Container);
    const item_class = itemPayload.Class;
    const name = itemPayload.ItemName.trim();
    const quality = itemPayload.Quality.toLowerCase() as CharacterItem["quality"];
    const properties = JSON.stringify(itemPayload.Properties);
    const slot = getItemSlot(
      container,
      inventoryTab,
      itemPayload.Location.BodyLocation
    );
    const x = itemPayload.Location.X;
    const y = itemPayload.Location.Y;
    const item_hash = hash32(
      item_class +
        name +
        quality +
        properties +
        container +
        (slot ? slot : "" + x + y)
    );

    const itemBeforeByHash = itemsBeforeByHash[item_hash];

    if (itemBeforeByHash && !removedItemHashes.includes(item_hash)) {
      removedItemHashes.push(item_hash);
    }

    addedItems.push({
      update_time: time,
      item_id,
      item_class,
      name,
      base_name: itemPayload.BaseItem.trim(),
      quality,
      properties,
      container,
      slot,
      x,
      y,
      width: itemPayload.Location.Width,
      height: itemPayload.Location.Height,
      item_hash,
    });
  }

  return {
    removedItemHashes,
    addedItems,
  };
}

export async function saveItemUpdates(
  characterId: number,
  { removedItemHashes, addedItems }: ItemUpdates
) {
  if (removedItemHashes.length) {
    await db.query(
      `
            DELETE FROM character_items WHERE character_id=$1
            AND item_hash IN (${removedItemHashes.map((_, i) => `$${2 + i}`)})
        `,
      [characterId, ...removedItemHashes]
    );
  }

  if (addedItems.length) {
    await db.query(
      `
            INSERT INTO character_items (
                character_id, update_time, item_id, item_class, name, base_name,
                quality, properties, container, slot, x, y, width, height, item_hash
            ) VALUES
            ${addedItems.map(
              (_, i) => `(
                $${15 * i + 1}, $${15 * i + 2}, $${15 * i + 3}, $${
                15 * i + 4
              }, $${15 * i + 5},
                $${15 * i + 6}, $${15 * i + 7}, $${15 * i + 8}, $${
                15 * i + 9
              }, $${15 * i + 10},
                $${15 * i + 11}, $${15 * i + 12}, $${15 * i + 13}, $${
                15 * i + 14
              }, $${15 * i + 15}
            )`
            )}
        `,
      Array.prototype.concat(
        ...addedItems.map((item) => [
          characterId,
          item.update_time,
          item.item_id,
          item.item_class,
          item.name,
          item.base_name,
          item.quality,
          item.properties,
          item.container,
          item.slot,
          item.x,
          item.y,
          item.width,
          item.height,
          item.item_hash,
        ])
      )
    );
  }
}
