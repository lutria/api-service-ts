import dayjs from 'dayjs'
import { parentPort } from 'node:worker_threads';
import pino from 'pino'
import { PrismaClient } from '@prisma/client'

const logger = pino({ level: process.env.LOG_LEVEL })

const prisma = new PrismaClient()

async function main() {
  logger.info("Scanning for stale sources")

  const sources = await prisma.source.findMany({
    where: {
      AND: [
        {
          enabled: true
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
        }
      ]
    }
  })
  logger.debug(`Found ${sources.length} sources`)
}

main()
  .then(async () => {
    await prisma.$disconnect()

    // signal to parent that the job is done
    if (parentPort) {
      parentPort.postMessage('done');
    } else {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(0)
    }
  })
  .catch(async (e) => {
    logger.error(e)
    await prisma.$disconnect()
    if (parentPort) {
      parentPort.postMessage('failed')
    } else {
      process.exit(1)
    }
  })


