import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme/colors';
import { HapticTouchable } from '../src/components/HapticTouchable';
import { Badge } from '../src/components/Badge';
import { api, Lesson } from '../src/api/endpoints';
import { haptic } from '../src/utils/haptics';

export default function LearnScreen() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    api
      .learn()
      .then((data) => setLessons(data))
      .catch((err) => console.log('Error loading lessons', err))
      .finally(() => setLoading(false));
  }, []);

  const openLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    haptic.selection();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>AURUM ACADEMY</Text>
          <Text style={styles.heroSubtitle}>
            Master quantitative trading, behavioral finance, risk discipline, and algorithmic strategy formulation.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          lessons.map((lesson) => (
            <HapticTouchable
              key={lesson.id}
              style={styles.lessonCard}
              onPress={() => openLesson(lesson)}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name={(lesson.icon as any) || 'book'}
                  size={20}
                  color={colors.gold}
                />
              </View>

              <View style={styles.lessonContent}>
                <View style={styles.badgeRow}>
                  <Badge label={lesson.track} variant="gold" />
                  <Badge label={lesson.level} variant="neutral" />
                  <Text style={styles.minutesText}>~{lesson.minutes} min</Text>
                </View>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </HapticTouchable>
          ))
        )}
      </ScrollView>

      {/* Lesson Reader Modal */}
      <Modal
        visible={!!selectedLesson}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedLesson(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Badge label={selectedLesson?.track || ''} variant="gold" />
              <Text style={styles.modalTitle}>{selectedLesson?.title}</Text>
            </View>
            <HapticTouchable
              style={styles.closeBtn}
              onPress={() => setSelectedLesson(null)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.modalBodyText}>{selectedLesson?.body}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 6,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonContent: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  minutesText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
  },
  modalBody: {
    padding: 20,
  },
  modalBodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
  },
});
