import { z } from 'zod';

export const zdSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  linkedZoneIds: z.array(z.string())
});

export const zfSchema = z.object({
  id: z.string(),
  name: z.string(),
  dasIds: z.array(z.string()),
  ugaChannel: z.string().optional()
});

export const dasSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['compartimentage', 'desenfumage', 'ventilation', 'evacuation', 'technique']),
  zoneId: z.string(),
  status: z.enum(['commande', 'en_position', 'defaut']).default('en_position')
});

export const scenarioEventSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  timestamp: z.number(),
  type: z.enum([
    'ALARME_DM',
    'ALARME_DAI',
    'DEFAUT_LIGNE',
    'COUPURE_SECTEUR',
    'DAS_BLOQUE',
    'UGA_HORS_SERVICE'
  ]),
  payload: z.record(z.any())
});

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  t1: z.number().default(15),
  t2: z.number().default(5),
  zd: z.array(zdSchema),
  zf: z.array(zfSchema),
  das: z.array(dasSchema),
  events: z.array(scenarioEventSchema)
});

export type Zd = z.infer<typeof zdSchema>;
export type Zf = z.infer<typeof zfSchema>;
export type Das = z.infer<typeof dasSchema>;
export type ScenarioEvent = z.infer<typeof scenarioEventSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export interface TrainingRunSummary {
  id: string;
  scenarioId: string;
  traineeId: string;
  trainerId: string;
  startedAt: string;
  endedAt?: string;
  score?: number;
}

export const scoreRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  delta: z.number()
});

export type ScoreRule = z.infer<typeof scoreRuleSchema>;

export const initialScoreRules: ScoreRule[] = [
  { id: 'ack-fast', label: 'Acquittement < 15 s', delta: 20 },
  { id: 'sequence-correct', label: 'Séquence opérationnelle complète', delta: 30 },
  { id: 'uga-stop-early', label: 'Arrêt UGA prématuré', delta: -25 },
  { id: 'no-reset', label: 'Absence de réarmement', delta: -10 }
];

export const defaultScenarios: Scenario[] = [
  {
    id: 'scenario-1',
    name: 'DM + UGA + Compartimentage',
    description: 'Déclencheur manuel avec mise en sécurité compartimentage et UGA.',
    t1: 15,
    t2: 5,
    zd: [
      { id: 'zd-1', name: 'Hall accueil', description: 'Zone d\'accueil principale', linkedZoneIds: ['zf-evac'] }
    ],
    zf: [
      { id: 'zf-evac', name: 'Évacuation', dasIds: ['das-portes'], ugaChannel: 'uga-principale' }
    ],
    das: [
      { id: 'das-portes', name: 'Portes coupe-feu', type: 'compartimentage', zoneId: 'zf-evac', status: 'en_position' }
    ],
    events: [
      { id: 'event-1', scenarioId: 'scenario-1', timestamp: 0, type: 'ALARME_DM', payload: { zdId: 'zd-1' } }
    ]
  },
  {
    id: 'scenario-2',
    name: 'DAI + Défaut DAS',
    description: 'Détecteur automatique et blocage d\'un DAS.',
    t1: 20,
    t2: 10,
    zd: [
      { id: 'zd-2', name: 'Atelier', linkedZoneIds: ['zf-des'], description: 'Atelier production' }
    ],
    zf: [
      { id: 'zf-des', name: 'Désenfumage', dasIds: ['das-volet'], ugaChannel: 'uga-secondaire' }
    ],
    das: [
      { id: 'das-volet', name: 'Volet désenfumage', type: 'desenfumage', zoneId: 'zf-des', status: 'commande' }
    ],
    events: [
      { id: 'event-2', scenarioId: 'scenario-2', timestamp: 0, type: 'ALARME_DAI', payload: { zdId: 'zd-2' } },
      { id: 'event-3', scenarioId: 'scenario-2', timestamp: 5, type: 'DAS_BLOQUE', payload: { dasId: 'das-volet' } }
    ]
  },
  {
    id: 'scenario-3',
    name: 'Coupure secteur',
    description: 'Coupure secteur avec bascule batterie et retour normal.',
    t1: 10,
    t2: 5,
    zd: [
      { id: 'zd-3', name: 'Tableau électrique', linkedZoneIds: ['zf-tech'], description: 'Local technique électrique' }
    ],
    zf: [
      { id: 'zf-tech', name: 'Technique', dasIds: ['das-vent'], ugaChannel: undefined }
    ],
    das: [
      { id: 'das-vent', name: 'Ventilation', type: 'technique', zoneId: 'zf-tech', status: 'en_position' }
    ],
    events: [
      { id: 'event-4', scenarioId: 'scenario-3', timestamp: 0, type: 'COUPURE_SECTEUR', payload: {} }
    ]
  }
];
