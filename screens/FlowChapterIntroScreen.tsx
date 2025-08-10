import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface FlowQuestion { backgroundInfo?: string; }
interface FlowChapter { id: string; title: string; questions: FlowQuestion[] }

const FlowChapterIntroScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const { chapter, storyId, storyTitle } = route.params as { chapter: FlowChapter; storyId: string; storyTitle: string };

  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * getFontSizeMultiplier());
  const backgroundText = (chapter as any).background || chapter.questions?.[0]?.backgroundInfo || 'Get ready!';
  const questionCount = chapter.questions?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <View style={[styles.card, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}> 
        <Text style={[styles.title, { color: theme.primaryText, fontSize: getScaledFontSize(22) }]}>{chapter.title}</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>from {storyTitle}</Text>

        <View style={[styles.infoBox, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}> 
          <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16), fontWeight: 'bold' }]}>Background</Text>
          <Text style={[styles.background, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>• {backgroundText}</Text>
        </View>

        <Text style={[styles.count, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>{questionCount} questions</Text>

        <View style={styles.actions}> 
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]} onPress={() => navigation.navigate('FlowDetailScreen', { storyId })}>
            <Text style={[styles.buttonText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('FlowQuestionsScreen', { storyId, chapter })}>
            <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16), fontWeight: 'bold' }]}>Start Chapter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { borderRadius: 16, padding: 20, borderWidth: 1 },
  title: { fontWeight: 'bold' },
  subtitle: { marginTop: 4, marginBottom: 12 },
  infoBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 12 },
  label: { marginBottom: 6 },
  background: { lineHeight: 22 },
  count: { textAlign: 'center', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  buttonText: { fontWeight: '600' },
});

export default FlowChapterIntroScreen; 