import fetch from 'node-fetch';

export async function broadcast(room: string, payload: any, twitchMessages: { channel: string, message: string }[] = []) {
    const res = await fetch(process.env.WS_URL as string, {
        method: 'POST',
        body: JSON.stringify({
            secret: process.env.SECRET,
            webMessages: [{ room, payload: JSON.stringify(payload) }],
            twitchMessages
        })
    });

    console.log(res.status);
}
