import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const userData: Prisma.UserCreateInput[] = [
  {
    name: 'Admin',
    privileged: true
  },
  {
    name: 'Joe User'
  }
]

const providerData: Prisma.ProviderCreateInput[] = [
  {
    name: "Alpha",
    security: {
      protected: true
    },
    sources: {
      create: [
        {
          name: "News",
          security: {
            protected: true
          },
          externalId: "News"
        }
      ]
    }
  },
  {
    name: "Beta",
    security: {},
    sources: {
      create: [
        {
          name: "Cooking Show",
          security: {},
          externalId: "Cooking Show"
        },
      ],
    },
  },
  {
    name: "Gamma",
    security: {},
    sources: {
      create: [
        {
          name: "Great Band",
          security: {},
          state: "SCAN_COMPLETE",
          externalType: "channel",
          externalId: "ghfugifhdif383",
          scannedAt: new Date(Date.UTC(2022, 0, 12, 21, 12, 5)),
          mediaItems: {
            create: [
              {
                name: "Great Band - Live Show",
                security: {},
                externalRef: "fndkggipe2392",
                previewAssets: [
                  {
                    type: "IMAGE",
                    externalRef: "https://cdn.com/fndkggipe2392.jpg"
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  }
]

async function main() {
  console.log(`Start seeding...`)

  for (const u of userData) {
    const user = await prisma.user.create({
      data: u
    })
    console.log(`Created user with id: ${user.id}`)
  }

  for (const p of providerData) {
    const provider = await prisma.provider.create({
      data: p,
    })
    console.log(`Created provider with id: ${provider.id}`)
  }

  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
