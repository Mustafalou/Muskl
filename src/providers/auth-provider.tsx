import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { supabase } from '@/lib/supabase';

type AuthResult = {
  error: string | null;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  profileError: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, username: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase surfaces a raw connectivity failure (e.g. "fetch failed: java.net.UnknownHostException...")
// as an AuthError like any other — that raw message is meaningless to an end user, so it's swapped
// for a friendly one instead of being shown as-is.
function isNetworkError(error: { name?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.name === 'AuthRetryableFetchError' ||
    /fetch failed|network request failed|unable to resolve host/i.test(error.message ?? '')
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Fires when the session came from a password-reset link specifically (not a normal
      // login) — route to the dedicated screen instead of letting Stack.Protected drop the
      // user straight into the app with their old password still unset.
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/reset-password');
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      const code = Linking.parse(url).queryParams?.code;
      if (typeof code === 'string') {
        supabase.auth.exchangeCodeForSession(code);
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Runs whenever a session appears (signup, login, confirmed-email deep link, app restart) and
  // backfills the `profiles` row from the username stashed in auth metadata if it's missing.
  // Decoupled from the signup screen on purpose: Stack.Protected can navigate away from it the
  // instant the session lands, before an insert kicked off there would ever resolve.
  useEffect(() => {
    const currentUser = session?.user;
    if (!currentUser) return;

    let isCancelled = false;

    async function ensureProfile() {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentUser!.id)
        .maybeSingle();

      if (isCancelled || existing) return;

      const username = currentUser!.user_metadata?.username;
      if (typeof username !== 'string' || !username) return;

      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ id: currentUser!.id, username });

      if (insertError && !isCancelled) {
        setProfileError(t('profile.createProfileError', { username, message: insertError.message }));
      }
    }

    ensureProfile();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the stable user id, not the session object which changes on every token refresh
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      profileError,

      async login(email, password) {
        setProfileError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) return { error: null };
        return { error: isNetworkError(error) ? t('auth.networkError') : error.message };
      },

      async signup(email, password, username) {
        setProfileError(null);
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
          return { error: t('auth.signup.chooseUsername') };
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: Linking.createURL('/'),
            // Stashed in auth metadata so the profile-backfill effect can create the
            // `profiles` row once a session exists, whenever that ends up happening.
            data: { username: trimmedUsername },
          },
        });
        if (error) {
          return { error: isNetworkError(error) ? t('auth.networkError') : error.message };
        }
        if (!data.user) {
          return { error: t('auth.signup.signupFailed') };
        }
        if (!data.session) {
          return { error: null, needsEmailConfirmation: true };
        }

        return { error: null };
      },

      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: Linking.createURL('/reset-password'),
        });
        if (!error) return { error: null };
        return { error: isNetworkError(error) ? t('auth.networkError') : error.message };
      },

      async logout() {
        await supabase.auth.signOut();
        setProfileError(null);
      },
    }),
    [session, isLoading, profileError, t],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
