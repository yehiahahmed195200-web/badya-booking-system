const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Connected to database via Prisma.');
    const tables = await prisma.$queryRawUnsafe("SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC");
    console.log('Tables and approximate row counts:');
    console.dir(tables, { depth: null });

    const top = tables.slice(0, 6);
    for (const t of top) {
      const name = t.TABLE_NAME || t.table_name || t.tableName;
      console.log(`\n--- Table: ${name} ---`);
      try {
        const cntRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM \`${name}\``);
        const cnt = cntRes && cntRes[0] ? cntRes[0].cnt || cntRes[0]['COUNT(*)'] || Object.values(cntRes[0])[0] : 'unknown';
        console.log('Row count:', cnt);
        const sample = await prisma.$queryRawUnsafe(`SELECT * FROM \`${name}\` LIMIT 5`);
        console.log('Sample rows:');
        console.dir(sample, { depth: 2 });
      } catch (err) {
        console.error('Error querying table', name, err.message || err);
      }
    }
  } catch (e) {
    console.error('Inspect failed:', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
})();
