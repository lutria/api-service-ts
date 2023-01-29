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
import routes from "./rest/routes.js";

const logger = pino({ level: process.env.LOG_LEVEL });
const prisma = new PrismaClient();

const natsClient = new NatsClient({
  logger,
  name: `api-service-${process.env.INSTANCE_ID}`,
  servers: process.env.NATS_URL,
});

await natsClient.connect();

natsClient.subscribe(subjects.STREAM_SCAN_REQUEST, "api-service", (data) => {
  logger.info(`Got message: ${JSON.stringify(data)}`);
});

const app = express();

app.use(
  pinoHttp({
    level: process.env.LOG_LEVEL,
    useLevel: "trace",
  })
);
app.use(bodyParser.json());
app.use(express.json());

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

app.use("/", routes);

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
