import express from "express";
import pino from "pino";

const router = express.Router();

const logger = pino({ level: process.env.LOG_LEVEL });

router.get("/sources", async (req, res) => {
  const sources = await req.context.sourceDao.findAll();
  res.json(sources);
});

router.get("/source/:name", async (req, res) => {
  const { name } = req.params;

  const source = await req.context.sourceDao.findByName(name);

  if (source === null) {
    return res.status(404).json({ error: "Source not found" });
  }

  res.json(source);
});

router.get("/source/:name/streams", async (req, res) => {
  const { name } = req.params;

  const streams = await req.context.streamDao.findManyBySource(name);

  return res.json(streams);
});

router.get("/streams/stale", async (req, res) => {
  const streams = await req.context.streamDao.findStale();
  return res.json(streams);
});

router.put("/stream/:name", async (req, res) => {
  const { name } = req.params;
  logger.info(`Updating stream with name ${name}`);

  const data = req.body;

  const stream = {
    state: data.state != null ? data.state : undefined,
    displayName: data.displayName != null ? data.displayName : undefined,
    externalType: data.externalType != null ? data.externalType : undefined,
    externalId: data.externalId != null ? data.externalId : undefined,
    enabled: data.enabled != null ? data.enabled : undefined,
    scanCursor: data.scanCursor != null ? data.scanCursor : undefined,
    scannedAt: data.scannedAt != null ? data.scannedAt : undefined,
  };

  const update = await req.context.streamDao.update(name, stream);

  return res.json(update);
});

router.get("/stream/:name/items", async (req, res) => {
  const { name } = req.params;

  const items = await req.context.itemDao.findManyByStream(name);

  res.json(items);
});

router.get("/item/:id", async (req, res) => {
  const { id } = req.params;

  const item = await req.context.xprisma.contentItem.findUnique({
    where: { id },
  });

  if (item === null) {
    return res.status(404).json({ error: "ContentItem not found" });
  }

  res.json(item);
});

export default router;
