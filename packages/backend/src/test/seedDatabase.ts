/**
 * Seed database with mock data for testing
 * Run this script to populate the database without needing the extension
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { TagGenerator } from '../services/tagGenerator.js';
import { mockSeriesData } from './mockData.js';
import { logger } from '../lib/logger.js';

const tagGenerator = new TagGenerator();

async function seedDatabase() {
  console.log('Starting database seed...');
  logger.info('Starting database seed...');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    logger.info('Clearing existing data...');
    await prisma.relationship.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.series.deleteMany();
    console.log('Existing data cleared');
    logger.info('Existing data cleared');

    // Insert mock series with generated tags
    logger.info(`Inserting ${mockSeriesData.length} mock series...`);
    const createdSeries = [];

    for (const seriesData of mockSeriesData) {
      // Generate tags
      const tags = tagGenerator.generateTags(seriesData);

      // Create series with tags
      const series = await prisma.series.create({
        data: {
          provider: seriesData.provider,
          mediaType: seriesData.mediaType,
          externalId: seriesData.externalId,
          url: seriesData.url,
          title: seriesData.title,
          titleImage: seriesData.titleImage,
          description: seriesData.description,
          rating: seriesData.rating,
          ageRating: seriesData.ageRating,
          languages: seriesData.languages,
          genres: seriesData.genres,
          contentAdvisory: seriesData.contentAdvisory,
          metadata: seriesData.metadata,
          tags: {
            create: tags.map(tag => ({
              value: tag.value,
              source: tag.source,
              confidence: tag.confidence,
              category: tag.category,
            })),
          },
        },
        include: { tags: true },
      });

      createdSeries.push(series);
      logger.info(`Created series: ${series.title} with ${series.tags.length} tags`);
    }

    // Create mock relationships based on tag similarity
    logger.info('Creating mock relationships...');
    const relationships = [
      // Action shounen trio
      { from: 0, to: 1 }, // SPY x FAMILY -> Demon Slayer
      { from: 0, to: 2 }, // SPY x FAMILY -> My Hero Academia
      { from: 1, to: 2 }, // Demon Slayer -> My Hero Academia
      { from: 1, to: 3 }, // Demon Slayer -> Jujutsu Kaisen
      { from: 2, to: 3 }, // My Hero Academia -> Jujutsu Kaisen
      { from: 3, to: 5 }, // Jujutsu Kaisen -> Chainsaw Man
      // Romance/comedy connection
      { from: 0, to: 4 }, // SPY x FAMILY -> Kaguya-sama (both have comedy)
    ];

    for (const rel of relationships) {
      const fromSeries = createdSeries[rel.from];
      const toSeries = createdSeries[rel.to];

      // Calculate similarity based on tags
      const fromTags = new Set(fromSeries.tags.map((t: any) => t.value));
      const toTags = new Set(toSeries.tags.map((t: any) => t.value));
      const intersection = new Set([...fromTags].filter(x => toTags.has(x)));
      const union = new Set([...fromTags, ...toTags]);
      const similarity = intersection.size / union.size;
      const sharedTags = [...intersection];

      await prisma.relationship.create({
        data: {
          fromSeriesId: fromSeries.id,
          toSeriesId: toSeries.id,
          similarity,
          sharedTags,
        },
      });

      logger.info(
        `Created relationship: ${fromSeries.title} -> ${toSeries.title} (similarity: ${(similarity * 100).toFixed(0)}%)`
      );
    }

    // Print summary
    const stats = {
      totalSeries: await prisma.series.count(),
      totalTags: await prisma.tag.count(),
      totalRelationships: await prisma.relationship.count(),
    };

    logger.info('Database seed complete!');
    logger.info('Summary:', stats);

    // Print some example queries
    logger.info('\n=== Sample Data ===');
    const firstSeries = createdSeries[0];
    logger.info(`\nSample Series: ${firstSeries.title}`);
    logger.info(`Tags: ${firstSeries.tags.map((t: any) => t.value).join(', ')}`);
    logger.info(`\nYou can now test the API endpoints!`);
    logger.info(`Example: curl http://localhost:3000/api/series/${firstSeries.id}`);

  } catch (error) {
    console.error('Error seeding database:', error);
    logger.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
console.log('Script starting...');
seedDatabase()
  .then(() => {
    console.log('Seed script completed successfully');
    logger.info('Seed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    logger.error('Seed script failed:', error);
    process.exit(1);
  });

export { seedDatabase };
