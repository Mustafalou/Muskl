import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { startTemplate } from '@/lib/start-template';
import { supabase } from '@/lib/supabase';
import type { WorkoutTemplate } from '@/types';

type TemplateWithCount = WorkoutTemplate & { exerciseCount: number };

export default function TemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data: templateRows, error: templatesError } = await supabase
      .from('workout_templates')
      .select('id, user_id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (templatesError) {
      setError(templatesError.message);
      setIsLoading(false);
      return;
    }

    const templateIds = (templateRows ?? []).map((template) => template.id);
    const countByTemplate: Record<string, number> = {};

    if (templateIds.length > 0) {
      const { data: exerciseRows } = await supabase
        .from('template_exercises')
        .select('template_id')
        .in('template_id', templateIds);

      for (const row of exerciseRows ?? []) {
        countByTemplate[row.template_id] = (countByTemplate[row.template_id] ?? 0) + 1;
      }
    }

    setTemplates(
      (templateRows ?? []).map((template) => ({
        ...template,
        exerciseCount: countByTemplate[template.id] ?? 0,
      })),
    );
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates]),
  );

  async function handleLaunch(template: TemplateWithCount) {
    if (!user || launchingId) return;
    setLaunchingId(template.id);
    setError(null);

    const result = await startTemplate(template.id, template.name, user.id);

    setLaunchingId(null);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.workoutId) {
      router.push(`/workout/${result.workoutId}`);
    }
  }

  function handleDelete(template: TemplateWithCount) {
    Alert.alert(t('templates.deleteConfirmTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setTemplates((prev) => prev.filter((item) => item.id !== template.id));
          supabase
            .from('workout_templates')
            .delete()
            .eq('id', template.id)
            .then(({ error: deleteError }) => {
              if (deleteError) setError(deleteError.message);
            });
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <ThemedText type="title">{t('templates.title')}</ThemedText>
          <Pressable
            onPress={() => router.push('/template/new')}
            style={[styles.addButton, { backgroundColor: theme.tint }]}>
            <SymbolView
              name={{ ios: 'plus', android: 'add', web: 'add' }}
              tintColor={theme.background}
              size={18}
              weight="bold"
            />
          </Pressable>
        </View>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}
        {!error && !isLoading && templates.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('templates.empty')}
          </ThemedText>
        ) : null}

        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/template/${item.id}`)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.cardText}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('templates.exerciseCount', { count: item.exerciseCount })}
                  </ThemedText>
                </View>
                <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.iconButton}>
                  <SymbolView
                    name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                    tintColor={theme.textSecondary}
                    size={16}
                  />
                </Pressable>
                <Pressable
                  onPress={() => handleLaunch(item)}
                  disabled={launchingId === item.id}
                  style={[styles.iconButton, { backgroundColor: theme.tint }]}>
                  <SymbolView
                    name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                    tintColor={theme.background}
                    size={16}
                  />
                </Pressable>
              </ThemedView>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  cardText: {
    flex: 1,
    gap: Spacing.half,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
