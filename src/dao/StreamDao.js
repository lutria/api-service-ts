import dayjs from "dayjs";

class StreamDao {
  constructor({ prisma, logger }) {
    this.prisma = prisma;
    this.logger = logger;
  }

  async findManyBySource(name) {
    return await this.prisma.stream.findMany({
      where: { source: { is: { name } } },
    });
  }

  async findStale() {
    return await this.prisma.stream.findMany({
      where: {
        AND: [
          {
            enabled: { equals: true },
          },
          {
            OR: [
              {
                scannedAt: {
                  isSet: false,
                },
              },
              {
                scannedAt: {
                  lte: dayjs().subtract(12, "hour").toDate(),
                },
              },
            ],
          },
          {
            state: {
              not: "SCAN_REQUESTED",
            },
          },
        ],
      },
    });
  }

  async update(name, stream) {
    return await this.prisma.stream.update({
      where: { name },
      data: { ...stream, updatedAt: new Date() },
    });
  }
}

export default StreamDao;
