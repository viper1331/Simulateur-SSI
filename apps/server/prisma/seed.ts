import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { defaultScenarios } from '@ssi/shared-models';

const prisma = new PrismaClient();

async function main() {
  for (const scenario of defaultScenarios) {
    const serializedConfig = JSON.stringify({
      t1: scenario.t1,
      t2: scenario.t2,
      zd: scenario.zd,
      zf: scenario.zf,
      das: scenario.das
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

  const trainerHash = await bcrypt.hash('Formateur!2024', 10);
  const traineeHash = await bcrypt.hash('Apprenant!2024', 10);

  await prisma.user.upsert({
    where: { email: 'formateur.demo@ssi.fr' },
    update: {
      name: 'Formateur Démo',
      passwordHash: trainerHash,
      role: 'TRAINER'
    },
    create: {
      name: 'Formateur Démo',
      email: 'formateur.demo@ssi.fr',
      passwordHash: trainerHash,
      role: 'TRAINER'
    }
  });

  await prisma.user.upsert({
    where: { email: 'apprenant.demo@ssi.fr' },
    update: {
      name: 'Apprenant Démo',
      passwordHash: traineeHash,
      role: 'TRAINEE'
    },
    create: {
      name: 'Apprenant Démo',
      email: 'apprenant.demo@ssi.fr',
      passwordHash: traineeHash,
      role: 'TRAINEE'
    }
  });

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
