import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const userData = [
  {
    name: "Admin",
    privileged: true,
  },
  {
    name: "svc-lutria",
    privileged: true,
  },
  {
    name: "Joe User",
  },
];

const sourceData = [
  {
    name: "com.alpha",
    displayName: "Alpha",
    security: {
      protected: true,
    },
    streams: {
      create: [
        {
          name: "News",
          security: {
            protected: true,
          },
          externalId: "News",
        },
      ],
    },
  },
  {
    name: "com.beta",
    displayName: "Beta",
    security: {},
    streams: {
      create: [
        {
          name: "Cooking Show",
          security: {},
          externalId: "Cooking Show",
        },
      ],
    },
  },
  {
    name: "com.gamma",
    displayName: "Gamma",
    security: {},
    streams: {
      create: [
        {
          name: "Great Band",
          security: {},
          state: "SCAN_COMPLETE",
          externalType: "channel",
          externalId: "ghfugifhdif383",
          scannedAt: new Date(Date.UTC(2022, 0, 12, 21, 12, 5)),
          contentItems: {
            create: [
              {
                name: "Great Band - Live Show",
                security: {},
                externalRef: "fndkggipe2392",
                previewAssets: [
                  {
                    type: "IMAGE",
                    externalRef: "https://cdn.com/fndkggipe2392.jpg",
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
];

async function main() {
  console.log(`Start seeding...`);

  for (const u of userData) {
    const user = await prisma.user.create({
      data: u,
    });
    console.log(`Created user with id: ${user.id}`);
  }

  for (const s of sourceData) {
    const source = await prisma.source.create({
      data: s,
    });
    console.log(`Created source with id: ${source.id}`);
  }

  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
