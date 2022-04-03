import { Router, Request, Response } from "express";
import * as bodyParser from "body-parser";
import { D2rItem } from "src/types";
import {
  getD2rItemDescriptionJpg,
  getD2rItemJpg,
  removeD2rItem,
  updateD2rItem,
} from "../collections/d2r_items";
import {
  getUserByAuthorizationHeader,
  getUserByName,
} from "../collections/users";

import { exec } from "child_process";
import { writeFile } from "fs";

export const router = Router();

router.post("/d2r/image", bodyParser.raw(), async function (req, res) {
  const user = await getUserByAuthorizationHeader(req.header("authorization"));

  if (!user) {
    res.sendStatus(401);
    return;
  }

  writeFile("test.jpg", req.body, () => {

    exec(
      `tesseract --psm 11 -l D2R test.jpg test tsv`,
      (err, stdout, stderr) => {
        if (err) {
          console.log(err);
        }

        console.log("hello!");
        console.log(req.body);
        res.sendStatus(200);
      }
    )
  });
});

router.post("/d2r/item", async function (req, res) {
  const user = await getUserByAuthorizationHeader(req.header("authorization"));

  if (!user) {
    res.sendStatus(401);
    return;
  }

  await updateD2rItem(
    user.id,
    req.body.container,
    req.body.slot,
    req.body.item_jpg ? Buffer.from(req.body.item_jpg, "base64") : null,
    req.body.description_jpg
      ? Buffer.from(req.body.description_jpg, "base64")
      : null
  );

  res.send("OK");
});

router.post("/d2r/remove-items", async function (req, res) {
  const user = await getUserByAuthorizationHeader(req.header("authorization"));

  if (!user) {
    res.sendStatus(401);
    return;
  }

  for (const [container, slot] of req.body) {
    await removeD2rItem(user.id, container, slot);
  }

  res.send("OK");
});

async function sendJpg(
  req: Request,
  res: Response,
  getJpg: (
    userId: number,
    container: D2rItem["container"],
    slot: D2rItem["slot"]
  ) => Promise<Buffer | null>
) {
  const user = await getUserByName(req.params.username);

  if (!user) {
    res.sendStatus(404);
    return;
  }

  const jpg = await getJpg(
    user.id,
    req.params.container as D2rItem["container"],
    req.params.slot as D2rItem["slot"]
  );

  if (!jpg) {
    res.sendStatus(404);
    return;
  }

  res.header("Content-Type", "image/jpeg");
  res.send(jpg);
}

router.get("/d2r/:username/item/:container/:slot.jpg", async (req, res) => {
  await sendJpg(req, res, getD2rItemJpg);
});

router.get(
  "/d2r/:username/item-description/:container/:slot.jpg",
  async (req, res) => {
    await sendJpg(req, res, getD2rItemDescriptionJpg);
  }
);
