import { PrismaClient, Prisma } from '@prisma/client'
import express from 'express'
import { NextFunction, Request, Response } from 'express'
import { forUser } from './security'

const prisma = new PrismaClient()

const app = express();
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
    console.log(error)
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
  console.error(err.stack)
  return res.status(500).json({ error: `Unexpected error: ${err.message}` })
})

const server = app.listen(3000, () => {
  console.log('Server ready at http://localhost:3000')
})
