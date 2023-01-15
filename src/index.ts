import { PrismaClient } from '@prisma/client'
import express from 'express'
import { forUser } from './security'

const prisma = new PrismaClient()

const app = express();
app.use(express.json())

// Middleware to create extended Prisma client with data security
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // TODO: Handle missing user header and non-existent user
  const user = await prisma.user.findUniqueOrThrow({ where: { name: req.header('x-user') } })
  req.xprisma = prisma.$extends(forUser({ privileged: user.privileged }))
  next();
})

app.get('/providers', async (req, res) => {
  const providers = await req.xprisma.provider.findMany()
  res.json(providers)
})

app.get('/provider/:id', async (req, res) => {
  const { id } = req.params

  const provider = await req.xprisma.provider.findUnique({ where: { id }})

  res.json(provider)
})

app.get('/provider/:id/sources', async (req, res) => {
  const { id } = req.params

  const sources = await req.xprisma.provider
    .findUniqueOrThrow({
      where: {
        id,
      }
    })
    .sources()

  res.json(sources)
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

  res.json(items)
})

app.get('/item/:id', async (req, res) => {
  const { id } = req.params

  const item = await req.xprisma.mediaItem.findUnique({ where: { id }})

  res.json(item)
})

const server = app.listen(3000, () => {
  console.log('Server ready at http://localhost:3000')
})
