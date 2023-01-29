class SourceDao {
  constructor({ prisma, logger }) {
    this.prisma = prisma;
    this.logger = logger;
  }

  async findAll() {
    return this.prisma.source.findMany();
  }

  async findByName(name) {
    return this.prisma.source.findUnique({ where: { name } });
  }
}

export default SourceDao;
