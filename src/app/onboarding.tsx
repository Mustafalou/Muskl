import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  buildStarterProgram,
  splitNameKey,
  type TrainingGoal,
  type TrainingLevel,
} from '@/constants/starter-programs';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { seedStarterTemplates } from '@/lib/seed-starter-templates';
import { supabase } from '@/lib/supabase';

const LEVELS: TrainingLevel[] = ['beginner', 'intermediate', 'advanced'];
const GOALS: TrainingGoal[] = ['hypertrophy', 'strength', 'general'];
const FREQUENCIES = [2, 3, 4, 5, 6];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();

  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [goal, setGoal] = useState<TrainingGoal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markOnboarded(extra: Record<string, unknown> = {}) {
    if (!user) return;
    await supabase.from('profile_stats').upsert({
      user_id: user.id,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...extra,
    });
  }

  async function handleSkip() {
    setIsSubmitting(true);
    await markOnboarded();
    router.back();
  }

  async function handleSubmit() {
    if (!user || !level || !frequency || !goal) return;
    setIsSubmitting(true);
    setError(null);

    // The chosen frequency doubles as the weekly goal, so the streak is live from day one instead
    // of waiting for a separate trip to the profile screen.
    await markOnboarded({ training_level: level, weekly_goal: frequency });

    const result = await seedStarterTemplates(user.id, buildStarterProgram(frequency, level, goal));

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.back();
  }

  const canSubmit = !!level && !!frequency && !!goal && !isSubmitting;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">{t('onboarding.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('onboarding.subtitle')}</ThemedText>

          <View style={styles.question}>
            <ThemedText type="cardTitle">{t('onboarding.levelQuestion')}</ThemedText>
            {LEVELS.map((option) => (
              <Option
                key={option}
                label={t(`onboarding.levels.${option}`)}
                hint={t(`onboarding.levelHints.${option}`)}
                selected={level === option}
                onPress={() => setLevel(option)}
              />
            ))}
          </View>

          <View style={styles.question}>
            <ThemedText type="cardTitle">{t('onboarding.frequencyQuestion')}</ThemedText>
            <View style={styles.frequencyRow}>
              {FREQUENCIES.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setFrequency(option)}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: frequency === option ? theme.tint : theme.backgroundElement,
                      borderColor: theme.border,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: frequency === option ? theme.background : theme.text }}>
                    {option}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {frequency ? (
              <ThemedText type="small" themeColor="tint">
                {t('onboarding.splitPreview', {
                  split: t(`onboarding.splits.${splitNameKey(frequency)}`),
                })}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.question}>
            <ThemedText type="cardTitle">{t('onboarding.goalQuestion')}</ThemedText>
            {GOALS.map((option) => (
              <Option
                key={option}
                label={t(`onboarding.goals.${option}`)}
                hint={t(`onboarding.goalHints.${option}`)}
                selected={goal === option}
                onPress={() => setGoal(option)}
              />
            ))}
          </View>

          {error ? (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title={t('onboarding.submit')}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
          />

          <Pressable onPress={handleSkip} disabled={isSubmitting}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.skip}>
              {t('onboarding.skip')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Option({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: selected ? theme.tint : theme.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {hint}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  question: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  option: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 2,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  frequencyChip: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
