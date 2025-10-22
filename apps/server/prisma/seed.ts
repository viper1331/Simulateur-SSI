import { PrismaClient } from '@prisma/client';
import { defaultScenarios } from '@ssi/shared-models';

const prisma = new PrismaClient();

async function main() {
  for (const scenario of defaultScenarios) {
    const serializedConfig = JSON.stringify({
      t1: scenario.t1,
      t2: scenario.t2,
      zd: scenario.zd,
      zf: scenario.zf,
      das: scenario.das,
      peripherals: scenario.peripherals
    });
    await prisma.scenario.upsert({
      where: { id: scenario.id },
      update: {
        name: scenario.name,
        description: scenario.description,
        config: serializedConfig
      },
      create: {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        config: serializedConfig,
        events: {
          create: scenario.events.map((event) => ({
            type: event.type,
            payload: JSON.stringify(event.payload ?? {}),
            offset: event.timestamp
          }))
        }
      }
    });
  }

  console.log('✅ Base de données Prisma initialisée.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
