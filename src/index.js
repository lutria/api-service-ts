import * as dotenv from 'dotenv'
dotenv.config()

import { PrismaClient } from '@prisma/client'
import bodyParser from 'body-parser'
import dayjs from 'dayjs'
import express from 'express'
import pino from 'pino'
import pinoHttp from 'pino-http'
import NatsClient from './nats-client.js'
import { forUser } from './security.js'

const STREAM_SCAN_REQUEST_SUBJECT = "work.stream_scan_request"

const logger = pino({ level: process.env.LOG_LEVEL })
const prisma = new PrismaClient()

const app = express();

app.use(pinoHttp({
  level: process.env.LOG_LEVEL,
  useLevel: 'trace'
}))
app.use(bodyParser.json())
app.use(express.json())

const natsClient = new NatsClient({
  logger,
  name: `api-service-${process.env.INSTANCE_ID}`,
  servers: process.env.NATS_URL,
})

await natsClient.connect()

natsClient.subscribe(STREAM_SCAN_REQUEST_SUBJECT, 'api-service', (data) => {
  logger.info(`Got message: ${JSON.stringify(data)}`)
})

// Middleware to create extended Prisma client with data security
app.use(async (req, res, next) => {
  const userFromHeader = req.header('x-user')
  if (!userFromHeader) {
    return res.status(401).json({ error: "No user specified"})
  }

  let user;
  try {
    user = await prisma.user.findUniqueOrThrow({ where: { name: req.header('x-user') } })
  } catch (error) {
    req.log.error(error)
    return res.status(401).json({ error: "User not found" })
  }

  req.xprisma = prisma.$extends(forUser(user))
  return next();
})

app.get('/sources', async (req, res) => {
  const sources = await req.xprisma.source.findMany()
  res.json(sources)
})

app.get('/source/:name', async (req, res) => {
  const { name } = req.params

  const source = await req.xprisma.source.findUnique({ where: { name }})

  if (source === null) {
    return res.status(404).json({ error: "Source not found" })
  }

  res.json(source)
})

app.get('/source/:name/streams', async (req, res) => {
  const { name } = req.params

  const streams = await req.xprisma.source.findUnique({ where: { name } }).streams()

  if (streams === null) {
    return res.status(404).json({ error: "Source not found" })
  }

  return res.json(streams)
})

app.get('/streams/stale', async (req, res) => {
  const streams = await req.xprisma.stream.findMany({
    where: {
      AND: [
        {
          enabled: { equals: true }
        },
        {
          OR: [
            {
              scannedAt: {
                isSet: false
              }
            }, {
              scannedAt: {
                lte: dayjs().subtract(12, 'hour').toDate()
              }
            }
          ]
        },
        {
          state: {
            not: "SCAN_REQUESTED"
          }
        }
      ]
    }
  })

  return res.json(streams)
})

app.put('/stream/:id', async (req, res) => {
  const { id } = req.params
  logger.info(`Updating stream with id ${id}`)

  const stream = req.body

  const update = await req.xprisma.stream.update({
    where: { id },
    data: {
      state: stream.state != null ? stream.state : undefined,
      name: stream.name != null ? stream.name : undefined,
      externalType: stream.externalType != null ? stream.externalType : undefined,
      externalId: stream.externalId != null ? stream.externalId : undefined,
      enabled: stream.enabled != null ? stream.enabled : undefined,
      scanCursor: stream.scanCursor != null ? stream.scanCursor : undefined,
      scannedAt: stream.scannedAt != null ? stream.scannedAt : undefined,
      updatedAt: new Date()
    }
  })

  return res.json(update)
})

app.get('/stream/:id/items', async (req, res) => {
  const { id } = req.params

  const items = await req.xprisma.stream
    .findUnique({
      where: {
        id,
      }
    })
    .contentItems()

  if (items === null) {
    return res.status(404).json({ error: "Stream not found" })
  }

  res.json(items)
})

app.get('/item/:id', async (req, res) => {
  const { id } = req.params

  const item = await req.xprisma.contentItem.findUnique({ where: { id }})

  if (item === null) {
    return res.status(404).json({ error: "ContentItem not found" })
  }

  res.json(item)
})

app.use((err, req, res, next) => {
  req.log.error(err.stack)
  return res.status(500).json({ error: `Unexpected error: ${err.message}` })
})

const server = app.listen(process.env.PORT, () => {
  logger.info(`⚡️ Server ready at http://localhost:${process.env.PORT}`)
})

const gracefulShutdown = () => {
  logger.info('Shutting down')

  natsClient.disconnect()
    .finally(() => {
      logger.info('NATS connection closed')

      server.close((err) => {
        if (err) {
          logger.error(err)
        }

        logger.info('Express server closed')

        process.exit(0)
      })
    })
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
