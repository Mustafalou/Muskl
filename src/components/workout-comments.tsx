import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const MAX_LENGTH = 500;

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
};

type WorkoutCommentsProps = {
  workoutId: string;
  // The workout's owner can delete any comment on it, not just their own.
  workoutOwnerId: string;
};

export function WorkoutComments({ workoutId, workoutOwnerId }: WorkoutCommentsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('workout_comments')
      .select('id, user_id, body, created_at')
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true });

    const rows = data ?? [];
    const authorIds = [...new Set(rows.map((row) => row.user_id))];
    let profileById: Record<string, { username: string; avatar_url: string | null }> = {};

    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', authorIds);
      profileById = Object.fromEntries(
        (profiles ?? []).map((profile) => [
          profile.id,
          { username: profile.username, avatar_url: profile.avatar_url },
        ]),
      );
    }

    setComments(
      rows.map((row) => ({
        ...row,
        username: profileById[row.user_id]?.username ?? null,
        avatar_url: profileById[row.user_id]?.avatar_url ?? null,
      })),
    );
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      loadComments();
    }, [loadComments]),
  );

  async function handleSend() {
    const body = draft.trim();
    if (!user || !body || isSending) return;

    setIsSending(true);
    const { error } = await supabase
      .from('workout_comments')
      .insert({ workout_id: workoutId, user_id: user.id, body });
    setIsSending(false);

    if (!error) {
      setDraft('');
      loadComments();
    }
  }

  function handleDelete(comment: CommentRow) {
    setComments((previous) => previous.filter((item) => item.id !== comment.id));
    supabase.from('workout_comments').delete().eq('id', comment.id).then(() => loadComments());
  }

  return (
    <View style={styles.container}>
      <ThemedText type="cardTitle">{t('comments.title', { count: comments.length })}</ThemedText>

      {comments.map((comment) => {
        const canDelete = user?.id === comment.user_id || user?.id === workoutOwnerId;
        return (
          <View key={comment.id} style={styles.comment}>
            <Pressable
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: comment.user_id } })}
              disabled={comment.user_id === user?.id}>
              <Avatar uri={comment.avatar_url} size={32} />
            </Pressable>
            <View style={styles.commentBody}>
              <ThemedText type="small" themeColor="tint">
                @{comment.username ?? '?'}
              </ThemedText>
              <ThemedText type="small">{comment.body}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(comment.created_at).toLocaleDateString(i18n.language, {
                  day: 'numeric',
                  month: 'short',
                })}
              </ThemedText>
            </View>
            {canDelete ? (
              <Pressable onPress={() => handleDelete(comment)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={theme.textSecondary}
                  size={12}
                />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <ThemedView type="backgroundElement" style={[styles.composer, { borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={t('comments.placeholder')}
          placeholderTextColor={theme.textSecondary}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_LENGTH}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
          style={[
            styles.sendButton,
            { backgroundColor: theme.tint },
            (!draft.trim() || isSending) && styles.disabled,
          ]}>
          <SymbolView
            name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
            tintColor={theme.background}
            size={14}
            weight="bold"
          />
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 96,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
