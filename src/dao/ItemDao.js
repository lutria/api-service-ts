class ItemDao {
  constructor({ prisma, logger }) {
    this.prisma = prisma;
    this.logger = logger;
  }

  async findManyByStream(name) {
    return this.prisma.contentItem.findMany({
      where: { stream: { is: { name } } },
    });
  }

  async findById(id) {
    return this.prisma.contentItem.findUnique({ where: { id } });
  }
}

export default ItemDao;
