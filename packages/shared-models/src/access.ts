export type AccessLevel = 0 | 1 | 2 | 3;

export const ACCESS_LEVELS: Record<AccessLevel, { label: string; rights: string[] }> = {
  0: {
    label: "Aucun accès actif",
    rights: []
  },
  1: {
    label: 'SSI 1',
    rights: ['Acquittement et tests visuels']
  },
  2: {
    label: 'SSI 2',
    rights: ['Réarmement CMSI et arrêt UGA']
  },
  3: {
    label: 'SSI 3',
    rights: ['Gestion des mises hors service']
  }
};

export const ACCESS_CODES: Array<{ level: Exclude<AccessLevel, 0>; code: string; label: string }> = [
  { level: 1, code: '1111', label: ACCESS_LEVELS[1].label },
  { level: 2, code: '2222', label: ACCESS_LEVELS[2].label },
  { level: 3, code: '3333', label: ACCESS_LEVELS[3].label }
];

export const getAccessLevelLabel = (level: AccessLevel): string => ACCESS_LEVELS[level].label;
