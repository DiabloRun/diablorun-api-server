import fetch from 'node-fetch';
import * as shortid from 'shortid';
import { URLSearchParams } from 'url';
import { getCharacters } from './characters';
import { getSpeedruns } from './speedruns';
import { Router } from 'express';
import db from '../services/db';
import { getCharacterSnapshotByUserId } from './snapshots';

export const router = Router();

// Create or update user
router.post('/users', async function (req, res) {
  const { access_token } = req.body;

  if (!access_token) {
    res.json(null);
    return;
  }

  try {
    const twitch = await fetch('https://api.twitch.tv/helix/users/', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-ID': process.env.TWITCH_CLIENT_ID || ''
      }
    });

    const { data } = await twitch.json();

    if (!data) {
      res.json(null);
      return;
    }
    
    const { id, login, display_name, offline_image_url, profile_image_url } = data[0];
    let user;

    try {
      user = await db.query(`
        INSERT INTO users (
          api_key, login, name, twitch_id, offline_image_url, profile_image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (twitch_id)
        DO UPDATE SET
          name=$3,
          login=$2,
          offline_image_url=$5,
          profile_image_url=$6
        RETURNING *
      `, [shortid(), login, display_name, id, offline_image_url, profile_image_url]);
    } catch (err) {
      user = await db.query(`
        INSERT INTO users (
          api_key, login, name, twitch_id, offline_image_url, profile_image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (login)
        DO UPDATE SET
          name=$3,
          twitch_id=$4,
          offline_image_url=$5,
          profile_image_url=$6
        RETURNING *
      `, [shortid(), login, display_name, id, offline_image_url, profile_image_url]);
    }

    if (user.rows[0].patreon_id) {
      const pledge = await db.query(`
        SELECT amount_cents FROM patreon_pledges WHERE patreon_user_id=$1
      `, [user.rows[0].patreon_id]);

      if (pledge.rows.length) {
        user.rows[0].patreon_amount_cents = pledge.rows[0].amount_cents;
      }
    }

    res.json(user.rows[0]);
  } catch (err) {
    console.log('ERROR!', err);
    res.json(null);
  }
});

// Get user by name
export async function getUserByName(username: string) {
  const user = await db.query(`
    SELECT
      id,
      name,
      country_code,
      dark_color_from AS color,
      profile_image_url
    FROM users WHERE login=$1 OR twitch_id=$1
  `, [username.toLowerCase()]);

  if (!user.rows.length) {
    return null;
  }

  return user.rows[0];
}

// Get currently active users
router.get('/active-users', async function (req, res) {
  const time = Math.floor(Date.now() / 1000) - 60;

  const { rows } = await db.query(`
    WITH active_characters AS (
      SELECT
          user_id, hero, level, difficulty, area, gold_stash, gold,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY update_time DESC) as user_index
      FROM characters WHERE update_time > $1
    )

    SELECT
      users.id,
      users.name AS user_name,
      users.country_code AS user_country_code,
      users.dark_color_from AS user_color,
      users.profile_image_url AS user_profile_image_url,
      active_characters.* FROM active_characters
    INNER JOIN users ON users.id = active_characters.user_id
    WHERE active_characters.user_index=1 ORDER BY user_name;
  `, [time]);

  res.json(rows);
});

// Get data for user profile
router.get('/users/:name/profile', async function (req, res) {
  const user = await getUserByName(req.params.name);

  res.json({
    user,
    lastUpdate: await getCharacterSnapshotByUserId(user.id),
    characters: await getCharacters({
      user_id: user.id,
      limit: 5
    }),
    speedruns: await getSpeedruns({
      user_id: user.id,
      order_by: 'submit_time',
      order_dir: 'DESC',
      limit: 10
    })
  });
});

// Link Patreon user
router.post('/users/:id/patreon', async function (req, res) {
  const params = new URLSearchParams();
  params.append('code', req.body.code);
  params.append('grant_type', 'authorization_code');
  params.append('client_id', process.env.PATREON_CLIENT_ID || '');
  params.append('client_secret', process.env.PATREON_CLIENT_SECRET || '');
  params.append('redirect_uri', req.body.redirect_uri);

  const oauthRes = await fetch('https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    body: params
  });

  const oauthBody = await oauthRes.json();

  if (!oauthBody.access_token) {
    res.status(401);
    res.send(oauthBody.error_description);
    return;
  }

  const patreonRes = await fetch('https://www.patreon.com/api/oauth2/v2/identity', {
    headers: {
      'Authorization': `Bearer ${oauthBody.access_token}`
    }
  });

  const patreonBody = await patreonRes.json();

  if (patreonBody.errors) {
    res.status(400);
    res.send(patreonBody.errors[0].detail);
    return;
  }

  await db.query(`
    UPDATE users SET patreon_id=NULL WHERE patreon_id=$1
  `, [patreonBody.data.id]);

  const result = await db.query(`
    UPDATE users
    SET patreon_id=$1
    WHERE id=$2 AND api_key=$3
  `, [
    patreonBody.data.id,
    req.params.id,
    req.header('Authorization')?.split(' ')[1]
  ]);

  if (!result.rowCount) {
    res.sendStatus(401);
    return;
  }

  res.json({ id: patreonBody.data.id });
});
