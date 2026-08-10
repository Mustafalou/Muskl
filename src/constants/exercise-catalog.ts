const EXERCISE_CATEGORIES = {
  Pecs: [
    'Développé couché',
    'Développé incliné',
    'Développé décliné',
    'Développé haltères',
    'Écarté couché',
    'Écarté poulie vis-à-vis',
    'Pompes',
    'Dips pectoraux',
    'Pec deck',
  ],
  Dos: [
    'Tractions',
    'Tractions lestées',
    'Rowing barre',
    'Rowing haltère',
    'Rowing T-bar',
    'Tirage horizontal',
    'Tirage vertical',
    'Soulevé de terre',
    'Soulevé de terre roumain',
    'Good morning',
    'Hyperextensions',
  ],
  Jambes: [
    'Squat',
    'Squat avant',
    'Presse à cuisses',
    'Fentes',
    'Fentes marchées',
    'Extension jambes',
    'Leg curl',
    'Hip thrust',
    'Mollets debout',
    'Mollets assis',
    'Gobelet squat',
  ],
  'Épaules': [
    'Développé militaire',
    'Développé haltères épaules',
    'Élévations latérales',
    'Élévations frontales',
    'Oiseau',
    'Face pull',
    'Shrugs',
    'Arnold press',
  ],
  Biceps: ['Curl biceps barre', 'Curl haltères', 'Curl marteau', 'Curl pupitre'],
  Triceps: [
    'Extension triceps poulie',
    'Barre au front',
    'Dips triceps',
    'Extension triceps unilatérale',
  ],
  Abdos: [
    'Crunch',
    'Relevé de jambes',
    'Planche',
    'Russian twist',
    'Ab wheel',
    'Crunch poulie haute',
  ],
  'Cardio & fonctionnel': [
    'Burpees',
    'Kettlebell swing',
    'Corde à sauter',
    'Rameur',
    'Assault bike',
    'Wall balls',
  ],
} as const;

export type CatalogExercise = {
  name: string;
  muscle: string;
};

export const MUSCLE_GROUPS: string[] = Object.keys(EXERCISE_CATEGORIES);

export const EXERCISE_CATALOG: CatalogExercise[] = Object.entries(EXERCISE_CATEGORIES).flatMap(
  ([muscle, names]) => names.map((name) => ({ name, muscle })),
);

const ACCENTS: Record<string, string> = {
  à: 'a',
  â: 'a',
  ä: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  î: 'i',
  ï: 'i',
  ô: 'o',
  ö: 'o',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ç: 'c',
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .split('')
    .map((char) => ACCENTS[char] ?? char)
    .join('');
}

export function filterExercises(query: string, muscle: string | null): CatalogExercise[] {
  const normalizedQuery = normalize(query.trim());

  return EXERCISE_CATALOG.filter((exercise) => {
    const matchesMuscle = !muscle || exercise.muscle === muscle;
    const matchesQuery = !normalizedQuery || normalize(exercise.name).includes(normalizedQuery);
    return matchesMuscle && matchesQuery;
  });
}
