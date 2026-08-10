import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type Section = {
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    title: '1. Qui est responsable de tes données',
    body: 'Muskl est un projet développé et exploité de façon indépendante. Pour toute question, contacte mustafaliiyilmaz@gmail.com.',
  },
  {
    title: '2. Données collectées',
    body: '• Compte : email et mot de passe (géré par Supabase Auth, jamais stocké en clair)\n• Profil : pseudo, photo de profil (optionnelle)\n• Statistiques corporelles (optionnelles) : taille, historique de poids\n• Séances : nom, date, exercices, séries (répétitions, poids, RPE)\n• Signalements : quelle séance, par qui',
  },
  {
    title: '3. Visibilité de tes données',
    body: "Muskl est une app sociale : ton pseudo, ta photo et tes séances sont visibles par tous dans le feed, par défaut. Ta taille et ton historique de poids ont un réglage de confidentialité séparé (onglet Profil → \"Profil public\"), activé par défaut — tu peux le désactiver à tout moment.",
  },
  {
    title: '4. Sous-traitant',
    body: "Les données sont hébergées chez Supabase (base de données, authentification, stockage des photos), dans l'Union Européenne. Aucune donnée n'est vendue ni partagée à des fins publicitaires — Muskl n'affiche aucune publicité et n'utilise aucun outil d'analytics tiers.",
  },
  {
    title: '5. Durée de conservation',
    body: 'Tes données sont conservées tant que ton compte existe. La suppression de compte efface tout définitivement.',
  },
  {
    title: '6. Suppression de ton compte',
    body: 'Onglet Profil → Supprimer mon compte. Action irréversible : supprime immédiatement ton compte, profil, photo, séances, exercices, séries, historique de poids et signalements.',
  },
  {
    title: '7. Tes droits',
    body: "Conformément au RGPD : accès, rectification, effacement, portabilité. La plupart sont disponibles directement dans l'app. Pour toute autre demande, contacte-nous.",
  },
  {
    title: '8. Signalement de contenu',
    body: "Tu peux signaler une séance depuis le feed. Les signalements sont visibles uniquement par toi et par l'équipe de Muskl.",
  },
  {
    title: '9. Sécurité',
    body: "L'accès aux données est protégé par des règles de sécurité au niveau de chaque ligne de la base de données (Row Level Security). Les échanges sont chiffrés (HTTPS).",
  },
  {
    title: '10. Âge minimum',
    body: "Muskl n'est pas destiné aux personnes de moins de 16 ans.",
  },
  {
    title: '11. Contact',
    body: 'mustafaliiyilmaz@gmail.com',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText themeColor="textSecondary" type="small">
            Dernière mise à jour : 10 août 2026
          </ThemedText>

          {SECTIONS.map((section) => (
            <ThemedView key={section.title} style={styles.section}>
              <ThemedText type="smallBold">{section.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {section.body}
              </ThemedText>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  section: {
    gap: Spacing.one,
  },
});
