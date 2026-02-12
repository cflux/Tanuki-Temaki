import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all series grouped by title, keeping the oldest (first fetched)
  const allSeries = await prisma.series.findMany({
    select: { id: true, title: true, externalId: true, fetchedAt: true },
    orderBy: { fetchedAt: 'asc' },
  });

  // Group by title
  const byTitle = new Map<string, typeof allSeries>();
  for (const s of allSeries) {
    const key = s.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(s);
  }

  // Find duplicates
  const toDelete: string[] = [];
  for (const [title, entries] of byTitle) {
    if (entries.length > 1) {
      console.log(`Duplicate: "${entries[0].title}"`);
      entries.forEach((e, i) => {
        console.log(`  [${i}] id=${e.id} externalId=${e.externalId} fetchedAt=${e.fetchedAt}`);
      });
      // Keep the first (oldest), delete the rest
      toDelete.push(...entries.slice(1).map(e => e.id));
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found.');
    return;
  }

  console.log(`\nDeleting ${toDelete.length} duplicate(s): ${toDelete.join(', ')}`);
  await prisma.series.deleteMany({ where: { id: { in: toDelete } } });
  console.log('Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
