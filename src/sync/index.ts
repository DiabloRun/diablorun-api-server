import * as dotenv from 'dotenv';
import { getUserByApiKey } from '../collections/users';
import { Character, CharacterSnapshot, getLatestCharacterSnapshotByName } from '../collections/characters';
import db from '../services/db';
import { getItemUpdates, saveItemUpdates } from './item-updates';
import { Payload } from './payload';
import { getCharacterUpdates, saveCharacterUpdates } from './character-updates';
import { getQuestUpdates, saveQuestUpdates } from './quest-updates';
import { broadcast } from '../services/ws';

const [MIN_MAJOR, MIN_MINOR, MIN_PATCH] = (process.env.MIN_DI_VERSION || '0.0.0').split('.').map(i => parseInt(i));

export async function sync(payload: Payload) {
    // Sync time
    const time = Math.floor(new Date().getTime() / 1000);

    // Verify DI version
    const version = payload.DIApplicationInfo.Version;
    const [major, minor, patch] = version.split('.').map(v => parseInt(v));

    if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR) || (minor === MIN_MINOR && patch < MIN_PATCH)) {
        throw {
            status: 400,
            message: `DiabloRun supports DiabloInterface 0.6.9 or later, you are currently running ${version}. Download the latest release from https://github.com/DiabloRun/DiabloInterface/releases`
        };
    }

    // Get user from headers
    const headers = dotenv.parse(payload.Headers);
    const user = await getUserByApiKey(headers.API_KEY);

    if (!user) {
        throw {
            status: 400,
            message: `Invalid or missing API_KEY. Visit https://diablo.run/setup`
        };
    }

    // Get character snapshot before update
    let before: CharacterSnapshot | undefined;

    if (!payload.NewCharacter) {
        before = await getLatestCharacterSnapshotByName(user.id, payload.Name);
    }

    // Get active inventory tab
    let inventoryTab = before ? before.character.inventory_tab : 0;

    if (payload.InventoryTab !== undefined) {
        inventoryTab = payload.InventoryTab;
    }

    // Get updates
    const questUpdates = getQuestUpdates(time, payload, before);
    const itemUpdates = getItemUpdates(time, payload, inventoryTab, before);
    const characterUpdates = getCharacterUpdates(time, payload, questUpdates, before);

    // Save updates
    let characterId: number;

    if (before) {
        characterId = before.character.id;
        await saveCharacterUpdates(characterId, characterUpdates);
    } else {
        const updatedKeys = Object.keys(characterUpdates) as (keyof Character)[];
        const result = await db.query(`
          INSERT INTO characters (user_id, name, ${updatedKeys})
          VALUES ($1, $2, ${updatedKeys.map((_, i) => `$${3 + i}`)})
          RETURNING id
        `, [user.id, payload.Name, ...updatedKeys.map(key => characterUpdates[key])]);

        characterId = result.rows[0].id;
    }

    await saveQuestUpdates(characterId, questUpdates);
    await saveItemUpdates(characterId, itemUpdates);

    // Broadcast updates
    const userRoom = `user/${user.login}`;

    await broadcast(userRoom, {
        action: 'update_character',
        id: characterId,
        name: payload.Name,
        characterUpdates,
        itemUpdates,
        questUpdates
    }, []);
}