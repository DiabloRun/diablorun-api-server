import "express-async-errors";
import { Router, Request, Response, NextFunction } from "express";
import * as bodyParser from "body-parser";

import * as users from "./users";
import * as characters from "./characters";
import * as home from "./home";
import * as races from "./races";
import * as speedruns from "./speedruns";
import * as webhooks from "./webhooks";
import * as sync from "./sync";
import * as snapshots from "./snapshots";
import * as ladder from "./ladder";
import * as bounties from "./bounties";
import * as d2r from "./d2r";

const router = Router();

router.use(bodyParser.json());
router.use(d2r.router);
router.use(sync.router);
router.use(users.router);
router.use(characters.router);
router.use(home.router);
router.use(races.router);
router.use(speedruns.router);
router.use(webhooks.router);
router.use(snapshots.router);
router.use(ladder.router);
router.use(bounties.router);

router.use(
  (
    err: { status: number; message: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (err && err.status) {
      res.status(err.status).send(err.message);
      return;
    }

    if (err) {
      console.log(err);
      res.status(500).send("Server error");
    }

    res.status(404).send("Not found");
  }
);

export default router;
