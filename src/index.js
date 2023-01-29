import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { NatsClient, subjects } from "@lutria/nats-common/src/index.js";
import { forUser } from "./security.js";
import SourceDao from "./dao/SourceDao.js";
import StreamDao from "./dao/StreamDao.js";
import ItemDao from "./dao/ItemDao.js";

const logger = pino({ level: process.env.LOG_LEVEL });
const prisma = new PrismaClient();

const app = express();

app.use(
  pinoHttp({
    level: process.env.LOG_LEVEL,
    useLevel: "trace",
  })
);
app.use(bodyParser.json());
app.use(express.json());

const natsClient = new NatsClient({
  logger,
  name: `api-service-${process.env.INSTANCE_ID}`,
  servers: process.env.NATS_URL,
});

await natsClient.connect();

natsClient.subscribe(subjects.STREAM_SCAN_REQUEST, "api-service", (data) => {
  logger.info(`Got message: ${JSON.stringify(data)}`);
});

// Middleware to create extended Prisma client with data security
app.use(async (req, res, next) => {
  const userFromHeader = req.header("x-user");
  if (!userFromHeader) {
    return res.status(401).json({ error: "No user specified" });
  }

  let user;
  try {
    user = await prisma.user.findUniqueOrThrow({
      where: { name: req.header("x-user") },
    });
  } catch (error) {
    req.log.error(error);
    return res.status(401).json({ error: "User not found" });
  }

  const xprisma = prisma.$extends(forUser(user));

  req.context = {
    itemDao: new ItemDao({ prisma: xprisma, logger }),
    sourceDao: new SourceDao({ prisma: xprisma, logger }),
    streamDao: new StreamDao({ prisma: xprisma, logger }),
    xprisma,
  };

  return next();
});

app.get("/sources", async (req, res) => {
  const sources = await req.context.sourceDao.findAll();
  res.json(sources);
});

app.get("/source/:name", async (req, res) => {
  const { name } = req.params;

  const source = await req.context.sourceDao.findByName(name);

  if (source === null) {
    return res.status(404).json({ error: "Source not found" });
  }

  res.json(source);
});

app.get("/source/:name/streams", async (req, res) => {
  const { name } = req.params;

  const streams = await req.context.streamDao.findManyBySource(name);

  return res.json(streams);
});

app.get("/streams/stale", async (req, res) => {
  const streams = await req.context.streamDao.findStale();
  return res.json(streams);
});

app.put("/stream/:name", async (req, res) => {
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

app.get("/stream/:name/items", async (req, res) => {
  const { name } = req.params;

  const items = await req.context.itemDao.findManyByStream(name);

  res.json(items);
});

app.get("/item/:id", async (req, res) => {
  const { id } = req.params;

  const item = await req.context.xprisma.contentItem.findUnique({
    where: { id },
  });

  if (item === null) {
    return res.status(404).json({ error: "ContentItem not found" });
  }

  res.json(item);
});

app.use((err, req, res, next) => {
  req.log.error(err.stack);
  return res.status(500).json({ error: `Unexpected error: ${err.message}` });
});

const server = app.listen(process.env.PORT, () => {
  logger.info(`⚡️ Server ready at http://localhost:${process.env.PORT}`);
});

const gracefulShutdown = () => {
  logger.info("Shutting down");

  natsClient.disconnect().finally(() => {
    logger.info("NATS connection closed");

    server.close((err) => {
      if (err) {
        logger.error(err);
      }

      logger.info("Express server closed");

      process.exit(0);
    });
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
