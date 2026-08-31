export type SupportedLanguage = 'fr' | 'en' | 'es';

const MUSCLE_GROUP_KEYS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'cardio',
] as const;

export type MuscleGroupKey = (typeof MUSCLE_GROUP_KEYS)[number];

const MUSCLE_GROUP_LABELS: Record<SupportedLanguage, Record<MuscleGroupKey, string>> = {
  fr: {
    chest: 'Pecs',
    back: 'Dos',
    legs: 'Jambes',
    shoulders: 'Épaules',
    biceps: 'Biceps',
    triceps: 'Triceps',
    abs: 'Abdos',
    cardio: 'Cardio & fonctionnel',
  },
  en: {
    chest: 'Chest',
    back: 'Back',
    legs: 'Legs',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    abs: 'Abs',
    cardio: 'Cardio & conditioning',
  },
  es: {
    chest: 'Pecho',
    back: 'Espalda',
    legs: 'Piernas',
    shoulders: 'Hombros',
    biceps: 'Bíceps',
    triceps: 'Tríceps',
    abs: 'Abdominales',
    cardio: 'Cardio y funcional',
  },
};

const EXERCISES_BY_MUSCLE: Record<MuscleGroupKey, Record<SupportedLanguage, string[]>> = {
  chest: {
    fr: [
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
    en: [
      'Bench Press',
      'Incline Bench Press',
      'Decline Bench Press',
      'Dumbbell Bench Press',
      'Dumbbell Fly',
      'Cable Crossover',
      'Push-ups',
      'Chest Dips',
      'Pec Deck',
    ],
    es: [
      'Press banca',
      'Press banca inclinado',
      'Press banca declinado',
      'Press banca con mancuernas',
      'Aperturas con mancuernas',
      'Cruce de poleas',
      'Flexiones',
      'Fondos de pecho',
      'Pec deck',
    ],
  },
  back: {
    fr: [
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
    en: [
      'Pull-ups',
      'Weighted Pull-ups',
      'Barbell Row',
      'Dumbbell Row',
      'T-Bar Row',
      'Seated Cable Row',
      'Lat Pulldown',
      'Deadlift',
      'Romanian Deadlift',
      'Good Morning',
      'Hyperextensions',
    ],
    es: [
      'Dominadas',
      'Dominadas lastradas',
      'Remo con barra',
      'Remo con mancuerna',
      'Remo en T',
      'Remo sentado en polea',
      'Jalón al pecho',
      'Peso muerto',
      'Peso muerto rumano',
      'Buenos días',
      'Hiperextensiones',
    ],
  },
  legs: {
    fr: [
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
      'Adducteurs (machine)',
      'Abducteurs (machine)',
    ],
    en: [
      'Squat',
      'Front Squat',
      'Leg Press',
      'Lunges',
      'Walking Lunges',
      'Leg Extension',
      'Leg Curl',
      'Hip Thrust',
      'Standing Calf Raise',
      'Seated Calf Raise',
      'Goblet Squat',
      'Hip Adduction Machine',
      'Hip Abduction Machine',
    ],
    es: [
      'Sentadilla',
      'Sentadilla frontal',
      'Prensa de piernas',
      'Zancadas',
      'Zancadas caminando',
      'Extensión de piernas',
      'Curl femoral',
      'Hip thrust',
      'Elevación de talones de pie',
      'Elevación de talones sentado',
      'Sentadilla goblet',
      'Máquina de aductores',
      'Máquina de abductores',
    ],
  },
  shoulders: {
    fr: [
      'Développé militaire',
      'Développé haltères épaules',
      'Élévations latérales',
      'Élévations frontales',
      'Oiseau',
      'Face pull',
      'Shrugs',
      'Arnold press',
    ],
    en: [
      'Military Press',
      'Dumbbell Shoulder Press',
      'Lateral Raises',
      'Front Raises',
      'Rear Delt Fly',
      'Face Pull',
      'Shrugs',
      'Arnold Press',
    ],
    es: [
      'Press militar',
      'Press de hombros con mancuernas',
      'Elevaciones laterales',
      'Elevaciones frontales',
      'Pájaros',
      'Face pull',
      'Encogimientos',
      'Press Arnold',
    ],
  },
  biceps: {
    fr: ['Curl biceps barre', 'Curl haltères', 'Curl marteau', 'Curl pupitre'],
    en: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl'],
    es: ['Curl de bíceps con barra', 'Curl con mancuernas', 'Curl martillo', 'Curl en banco Scott'],
  },
  triceps: {
    fr: [
      'Extension triceps poulie',
      'Barre au front',
      'Dips triceps',
      'Extension triceps unilatérale',
    ],
    en: [
      'Triceps Pushdown',
      'Skull Crushers',
      'Triceps Dips',
      'Single-Arm Triceps Extension',
    ],
    es: [
      'Extensión de tríceps en polea',
      'Press francés',
      'Fondos de tríceps',
      'Extensión de tríceps a una mano',
    ],
  },
  abs: {
    fr: ['Crunch', 'Relevé de jambes', 'Planche', 'Russian twist', 'Ab wheel', 'Crunch poulie haute'],
    en: ['Crunch', 'Leg Raises', 'Plank', 'Russian Twist', 'Ab Wheel', 'Cable Crunch'],
    es: ['Crunch', 'Elevación de piernas', 'Plancha', 'Giro ruso', 'Rueda abdominal', 'Crunch en polea'],
  },
  cardio: {
    fr: ['Burpees', 'Kettlebell swing', 'Corde à sauter', 'Rameur', 'Assault bike', 'Wall balls'],
    en: ['Burpees', 'Kettlebell Swing', 'Jump Rope', 'Rowing Machine', 'Assault Bike', 'Wall Balls'],
    es: ['Burpees', 'Swing con kettlebell', 'Salto a la cuerda', 'Máquina de remo', 'Assault bike', 'Wall balls'],
  },
};

export type CatalogExercise = {
  name: string;
  muscle: string;
  // Stable across languages (`${muscleGroup}:${indexWithinGroup}`) — lets any viewer's language
  // re-render this exercise's name via translateCatalogExerciseName, even if the workout was
  // logged by someone else in a different language. IMPORTANT: only ever append to the end of a
  // muscle group's arrays above — inserting/reordering shifts every index after it and silently
  // mistranslates already-saved exercises that reference the old positions.
  catalogKey: string;
};

export function getMuscleGroups(language: SupportedLanguage): string[] {
  return MUSCLE_GROUP_KEYS.map((key) => MUSCLE_GROUP_LABELS[language][key]);
}

export function getExerciseCatalog(language: SupportedLanguage): CatalogExercise[] {
  return MUSCLE_GROUP_KEYS.flatMap((key) =>
    EXERCISES_BY_MUSCLE[key][language].map((name, index) => ({
      name,
      muscle: MUSCLE_GROUP_LABELS[language][key],
      catalogKey: `${key}:${index}`,
    })),
  );
}

// Resolves a stored `catalogKey` to its name in a different viewer's language — returns null if
// the key doesn't match any known catalog entry (e.g. a custom, free-typed exercise never has one).
export function translateCatalogExerciseName(
  catalogKey: string,
  language: SupportedLanguage,
): string | null {
  const [muscleKey, indexPart] = catalogKey.split(':');
  const index = Number(indexPart);
  if (!Number.isInteger(index) || !(MUSCLE_GROUP_KEYS as readonly string[]).includes(muscleKey)) {
    return null;
  }
  return EXERCISES_BY_MUSCLE[muscleKey as MuscleGroupKey][language][index] ?? null;
}

// Convenience wrapper for rendering: falls back to the exercise's own stored name for custom,
// free-typed exercises (no catalogKey) or any key that no longer resolves.
export function getExerciseDisplayName(
  exercise: { name: string; catalog_key?: string | null },
  language: SupportedLanguage,
): string {
  if (!exercise.catalog_key) return exercise.name;
  return translateCatalogExerciseName(exercise.catalog_key, language) ?? exercise.name;
}

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
  ñ: 'n',
};

export function normalize(text: string) {
  return text
    .toLowerCase()
    .split('')
    .map((char) => ACCENTS[char] ?? char)
    .join('');
}

export function filterExercises(
  query: string,
  muscle: string | null,
  language: SupportedLanguage,
): CatalogExercise[] {
  const normalizedQuery = normalize(query.trim());
  const catalog = getExerciseCatalog(language);

  return catalog.filter((exercise) => {
    const matchesMuscle = !muscle || exercise.muscle === muscle;
    const matchesQuery = !normalizedQuery || normalize(exercise.name).includes(normalizedQuery);
    return matchesMuscle && matchesQuery;
  });
}
