import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Week 0 暂不写入示例数据，仅验证数据库连接
  console.log('Seed placeholder executed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
