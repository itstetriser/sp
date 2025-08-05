import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface WordWithSpacedRepetition {
  word: string;
  type?: string;
  definition?: string;
  example1?: string;
  example2?: string;
  equivalent?: string;
  nextReview?: number;
  reviewCount?: number;
  intervalIndex?: number;
  lastReviewed?: number;
  easeFactor?: number;
  consecutiveCorrect?: number;
  totalCorrect?: number;
  totalIncorrect?: number;
  masteryLevel?: 'new' | 'learning' | 'reviewing' | 'mastered' | 'learned';
  masteredAt?: number;
  learnedAt?: number;
}

const LearnedWordsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'newToOld' | 'oldToNew'>('newToOld');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const fetchLearnedWords = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && Array.isArray(userSnap.data().myWords)) {
        const rawWords = userSnap.data().myWords;
        const learnedWords = rawWords.filter((word: any) => {
          if (typeof word === 'string') return false;
          return word.masteryLevel === 'learned';
        });
        setWords(learnedWords);
      } else {
        setWords([]);
      }
    } catch (error) {
      console.error('Error fetching learned words:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearnedWords();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchLearnedWords();
    }, [])
  );

  const sortedWords = [...words].sort((a, b) => {
    const aDate = a.learnedAt || 0;
    const bDate = b.learnedAt || 0;
    
    if (sortOrder === 'newToOld') {
      return bDate - aDate;
    } else {
      return aDate - bDate;
    }
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
            Loading learned words...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
          Learned Words
        </Text>
        
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortDropdown(!showSortDropdown)}
        >
          <Ionicons name="funnel" size={20} color={theme.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Sort Dropdown */}
      {showSortDropdown && (
        <View style={[styles.sortDropdown, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
          <TouchableOpacity
            style={[
              styles.sortOption,
              { backgroundColor: sortOrder === 'newToOld' ? theme.primary + '20' : 'transparent' }
            ]}
            onPress={() => {
              setSortOrder('newToOld');
              setShowSortDropdown(false);
            }}
          >
            <Text style={[
              styles.sortOptionText,
              { 
                color: sortOrder === 'newToOld' ? theme.primary : theme.secondaryText,
                fontSize: getScaledFontSize(14)
              }
            ]}>
              Newest first
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sortOption,
              { backgroundColor: sortOrder === 'oldToNew' ? theme.primary + '20' : 'transparent' }
            ]}
            onPress={() => {
              setSortOrder('oldToNew');
              setShowSortDropdown(false);
            }}
          >
            <Text style={[
              styles.sortOptionText,
              { 
                color: sortOrder === 'oldToNew' ? theme.primary : theme.secondaryText,
                fontSize: getScaledFontSize(14)
              }
            ]}>
              Oldest first
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Words Count */}
      <View style={[styles.countContainer, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
        <Text style={[styles.countText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
          {sortedWords.length} learned word{sortedWords.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Words List */}
      {sortedWords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            No Learned Words Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
            Complete stories to start building your vocabulary!
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.wordsContainer} showsVerticalScrollIndicator={false}>
          {sortedWords.map((word, index) => (
            <View key={index} style={[styles.wordCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
              <View style={styles.wordHeader}>
                <Text style={[styles.wordText, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
                  {word.word}
                </Text>
                {word.type && (
                  <View style={[styles.typeBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.typeText, { color: theme.primary, fontSize: getScaledFontSize(12) }]}>
                      {word.type}
                    </Text>
                  </View>
                )}
              </View>
              
              {word.definition && (
                <Text style={[styles.definitionText, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                  {word.definition}
                </Text>
              )}
              
              {word.equivalent && (
                <Text style={[styles.equivalentText, { color: theme.success, fontSize: getScaledFontSize(14) }]}>
                  {word.equivalent}
                </Text>
              )}
              
              {(word.example1 || word.example2) && (
                <View style={styles.examplesContainer}>
                  {word.example1 && (
                    <Text style={[styles.exampleText, { color: theme.secondaryText, fontSize: getScaledFontSize(13) }]}>
                      • {word.example1}
                    </Text>
                  )}
                  {word.example2 && (
                    <Text style={[styles.exampleText, { color: theme.secondaryText, fontSize: getScaledFontSize(13) }]}>
                      • {word.example2}
                    </Text>
                  )}
                </View>
              )}
              
              <View style={styles.wordFooter}>
                <Text style={[styles.learnedDate, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>
                  Learned: {word.learnedAt ? formatDate(word.learnedAt) : 'Unknown'}
                </Text>
                <Text style={[styles.reviewCount, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>
                  Reviews: {word.reviewCount || 0}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  sortButton: {
    padding: 8,
  },
  sortDropdown: {
    position: 'absolute',
    top: 80,
    right: 20,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  sortOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sortOptionText: {
    fontWeight: '500',
  },
  countContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  countText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  wordsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  wordCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordText: {
    fontWeight: 'bold',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontWeight: 'bold',
  },
  definitionText: {
    marginBottom: 8,
    lineHeight: 20,
  },
  equivalentText: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  examplesContainer: {
    marginBottom: 12,
  },
  exampleText: {
    lineHeight: 18,
    marginBottom: 4,
  },
  wordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  learnedDate: {
    opacity: 0.7,
  },
  reviewCount: {
    opacity: 0.7,
  },
});

export default LearnedWordsScreen; 