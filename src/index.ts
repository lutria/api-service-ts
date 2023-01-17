import * as dotenv from 'dotenv'
dotenv.config()

import bodyParser from 'body-parser'
import Bree from 'bree';
import { PrismaClient } from '@prisma/client'
import express from 'express'
import path from 'path'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { NextFunction, Request, Response } from 'express'
import jobs from './jobs'
import { forUser } from './security'

const logger = pino({ level: process.env.LOG_LEVEL })
const prisma = new PrismaClient()

const bree = new Bree({
  logger: logger,
  jobs,
  root: path.join(__dirname, 'jobs')
});

(async () => {
  await bree.start()
})()

const app = express();

app.use(pinoHttp({
  level: process.env.LOG_LEVEL,
  useLevel: 'trace'
}))
app.use(bodyParser.json())
app.use(express.json())

// Middleware to create extended Prisma client with data security
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

app.get('/providers', async (req, res) => {
  const providers = await req.xprisma.provider.findMany()
  res.json(providers)
})

app.get('/provider/:id', async (req, res) => {
  const { id } = req.params

  const provider = await req.xprisma.provider.findUnique({ where: { id }})

  if (provider === null) {
    return res.status(404).json({ error: "Provider not found" })
  }

  res.json(provider)
})

app.get('/provider/:id/sources', async (req, res, next) => {
  const { id } = req.params

  const sources = await req.xprisma.provider.findUnique({ where: { id } }).sources()

  if (sources === null) {
    return res.status(404).json({ error: "Provider not found" })
  }

  return res.json(sources)
})

app.get('/source/:id/items', async (req, res) => {
  const { id } = req.params

  const items = await req.xprisma.source
    .findUnique({
      where: {
        id,
      }
    })
    .mediaItems()

  if (items === null) {
    return res.status(404).json({ error: "Source not found" })
  }

  res.json(items)
})

app.get('/item/:id', async (req, res) => {
  const { id } = req.params

  const item = await req.xprisma.mediaItem.findUnique({ where: { id }})

  if (item === null) {
    return res.status(404).json({ error: "Item not found" })
  }

  res.json(item)
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  req.log.error(err.stack)
  return res.status(500).json({ error: `Unexpected error: ${err.message}` })
})

const server = app.listen(process.env.PORT, () => {
  logger.info(`⚡️ Server ready at http://localhost:${process.env.PORT}`)
})
