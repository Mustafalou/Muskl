import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { translateCatalogExerciseName, type SupportedLanguage } from '@/constants/exercise-catalog';
import { TEMPLATE_LIBRARY, type LibraryProgram } from '@/constants/template-library';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { insertTemplates } from '@/lib/insert-templates';

export default function TemplateLibraryScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const theme = useTheme();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(program: LibraryProgram) {
    if (!user || addingId) return;
    setAddingId(program.id);
    setError(null);

    // Session names are resolved now, in the user's language: from here on they're the user's
    // own templates, free to rename.
    const { error: insertError } = await insertTemplates(
      user.id,
      program.sessions.map((session) => ({ name: t(session.nameKey), exercises: session.exercises })),
      language,
    );

    setAddingId(null);
    if (insertError) {
      setError(insertError);
      return;
    }
    setAddedIds((prev) => [...prev, program.id]);
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText themeColor="textSecondary">{t('library.intro')}</ThemedText>

          {error ? (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          ) : null}

          {TEMPLATE_LIBRARY.map((program) => {
            const isOpen = openId === program.id;
            const isAdded = addedIds.includes(program.id);

            return (
              <ThemedView
                key={program.id}
                type="backgroundElement"
                style={[styles.card, { borderColor: isOpen ? theme.tint : theme.border }]}>
                <Pressable
                  onPress={() => setOpenId(isOpen ? null : program.id)}
                  style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}>
                  <View style={styles.cardText}>
                    <ThemedText type="cardTitle">{t(`library.programs.${program.id}.name`)}</ThemedText>
                    <ThemedText type="small" themeColor="tint">
                      {[
                        t(`onboarding.levels.${program.level}`),
                        t('library.perWeek', { count: program.daysPerWeek }),
                        t('library.sessionCount', { count: program.sessions.length }),
                      ].join(' · ')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`library.programs.${program.id}.description`)}
                    </ThemedText>
                  </View>
                  <SymbolView
                    name={{
                      ios: isOpen ? 'chevron.up' : 'chevron.down',
                      android: isOpen ? 'expand_less' : 'expand_more',
                      web: isOpen ? 'expand_less' : 'expand_more',
                    }}
                    tintColor={theme.textSecondary}
                    size={16}
                  />
                </Pressable>

                {isOpen ? (
                  <View style={styles.details}>
                    {program.sessions.map((session) => (
                      <View key={session.nameKey} style={styles.session}>
                        <ThemedText type="smallBold">{t(session.nameKey)}</ThemedText>
                        {session.exercises.map((exercise, index) => {
                          const previous = session.exercises[index - 1];
                          const startsSuperset = !!exercise.superset && previous?.superset !== exercise.superset;
                          return (
                            <View key={`${exercise.catalogKey}-${index}`}>
                              {startsSuperset ? (
                                <ThemedText type="small" themeColor="tint" style={styles.supersetLabel}>
                                  {t('workout.superset.label')}
                                </ThemedText>
                              ) : null}
                              <View
                                style={[
                                  styles.exerciseRow,
                                  exercise.superset ? [styles.inSuperset, { borderColor: theme.tint }] : null,
                                ]}>
                                <ThemedText type="small" style={styles.exerciseName} numberOfLines={1}>
                                  {translateCatalogExerciseName(exercise.catalogKey, language) ?? exercise.catalogKey}
                                </ThemedText>
                                <ThemedText type="small" themeColor="textSecondary">
                                  {t('library.setsReps', { sets: exercise.sets, reps: exercise.reps })}
                                </ThemedText>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ))}

                    <PrimaryButton
                      title={isAdded ? t('library.added') : t('library.add')}
                      onPress={() => handleAdd(program)}
                      loading={addingId === program.id}
                      disabled={isAdded}
                    />
                  </View>
                ) : null}
              </ThemedView>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  details: {
    gap: Spacing.three,
  },
  session: {
    gap: Spacing.one,
  },
  supersetLabel: {
    marginTop: Spacing.one,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Same visual language as supersets in a workout: a tint bar down the left edge.
  inSuperset: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
  },
  exerciseName: {
    flex: 1,
  },
});
