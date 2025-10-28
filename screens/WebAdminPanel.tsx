import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface Story {
  id: string;
  title: string;
  description: string;
  level: string;
  emoji: string;
  imageUrl?: string;
  chapters: Chapter[];
  createdAt: Date;
  active?: boolean;
}

interface Chapter {
  id: string;
  title: string;
  questions: Question[];
  vocabulary?: any[];
  active?: boolean;
}

interface Question {
  id: string;
  npcName: string;
  npcSentence: string;
  npcIcon: string;
  correctAnswer: string;
  correctEmoji: string;
  incorrectAnswer1: string;
  incorrectEmoji1: string;
  incorrectAnswer2: string;
  incorrectEmoji2: string;
  incorrectAnswer3: string;
  incorrectEmoji3: string;
  backgroundInfo: string;
  moodEmoji: string;
}

const WebAdminPanel = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Story creation
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');
  const [newStoryLevel, setNewStoryLevel] = useState('Easy');
  const [newStoryImageUrl, setNewStoryImageUrl] = useState('');
  
  // Chapter creation
  const [newChapterTitle, setNewChapterTitle] = useState('');
  
  // Bulk dialogue upload
  const [bulkDialogues, setBulkDialogues] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Bulk vocabulary upload
  const [bulkVocabText, setBulkVocabText] = useState('');
  const [showBulkVocabModal, setShowBulkVocabModal] = useState(false);

  // Edit mode
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [editStoryTitle, setEditStoryTitle] = useState('');
  const [editStoryDescription, setEditStoryDescription] = useState('');
  const [editStoryLevel, setEditStoryLevel] = useState('');
  const [editStoryEmoji, setEditStoryEmoji] = useState('');
  const [editStoryImageUrl, setEditStoryImageUrl] = useState('');

  // Chapter editing
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');

  // Question editing
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editQuestionNpc, setEditQuestionNpc] = useState('');
  const [editQuestionCorrect, setEditQuestionCorrect] = useState('');
  const [editQuestionCorrectEmoji, setEditQuestionCorrectEmoji] = useState('');
  const [editQuestionIncorrect1, setEditQuestionIncorrect1] = useState('');
  const [editQuestionIncorrectEmoji1, setEditQuestionIncorrectEmoji1] = useState('');
  const [editQuestionIncorrect2, setEditQuestionIncorrect2] = useState('');
  const [editQuestionIncorrectEmoji2, setEditQuestionIncorrectEmoji2] = useState('');
  const [editQuestionIncorrect3, setEditQuestionIncorrect3] = useState('');
  const [editQuestionIncorrectEmoji3, setEditQuestionIncorrectEmoji3] = useState('');
  const [editQuestionMood, setEditQuestionMood] = useState('');
  const [editQuestionMoodEmoji, setEditQuestionMoodEmoji] = useState('');

  // Vocabulary editing
  const [editingVocab, setEditingVocab] = useState<any>(null);
  const [editVocabWord, setEditVocabWord] = useState('');
  const [editVocabType, setEditVocabType] = useState('');
  const [editVocabDefinition, setEditVocabDefinition] = useState('');
  
  // Support messages
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);
  const [editVocabExample1, setEditVocabExample1] = useState('');
  const [editVocabExample2, setEditVocabExample2] = useState('');
  const [editVocabEquivalent, setEditVocabEquivalent] = useState('');

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  useEffect(() => {
    fetchStories();
    fetchPendingMessagesCount();
  }, []);

  const fetchStories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'stories'));
      const storiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      setStories(storiesData);
    } catch (error) {
      console.error('Error fetching stories:', error);
      Alert.alert('Error', 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingMessagesCount = async () => {
    try {
      const messagesQuery = query(
        collection(db, 'supportMessages'),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(messagesQuery);
      setPendingMessagesCount(querySnapshot.size);
    } catch (error) {
      console.error('Error fetching pending messages count:', error);
    }
  };

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    try {
      const newStoryRef = await addDoc(collection(db, 'stories'), {
        title: newStoryTitle.trim(),
        description: newStoryDescription.trim(),
        level: newStoryLevel,
        imageUrl: newStoryImageUrl,
        chapters: [],
        createdAt: new Date(),
        active: false, // Default to inactive
      });

      setNewStoryTitle('');
      setNewStoryDescription('');
      setNewStoryLevel('Easy');
      setNewStoryImageUrl('');
      
      // Fetch updated stories
      await fetchStories();
      
      // Auto-select the newly created story
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const newStory = freshStoryData.find(s => s.id === newStoryRef.id);
      if (newStory) {
        setSelectedStory(newStory);
      }
      
      Alert.alert('Success', 'Story created successfully');
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', 'Failed to create story');
    }
  };

  const handleAddChapter = async () => {
    const targetStory = editingStory || selectedStory;
    if (!targetStory || !newChapterTitle.trim()) {
      Alert.alert('Error', 'Please select a story and enter a chapter title');
      return;
    }

    try {
      const storyRef = doc(db, 'stories', targetStory.id);
      const newChapter: Chapter = {
        id: Date.now().toString(),
        title: newChapterTitle.trim(),
        questions: [],
        active: false, // Default to inactive
      };

      await updateDoc(storyRef, {
        chapters: [...targetStory.chapters, newChapter],
      });

      setNewChapterTitle('');
      
      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === targetStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
        // Auto-select the newly created chapter
        const newChapterInUpdatedStory = freshStory.chapters.find(c => c.title === newChapter.title);
        if (newChapterInUpdatedStory) {
          setSelectedChapter(newChapterInUpdatedStory);
        }
      }
      
      Alert.alert('Success', 'Chapter added successfully');
    } catch (error) {
      console.error('Error adding chapter:', error);
      Alert.alert('Error', 'Failed to add chapter');
    }
  };

  const handleBulkUploadDialogues = async () => {
    const targetStory = editingStory || selectedStory;
    const targetChapter = selectedChapter;
    
    console.log('Upload Dialogues - Target Story:', targetStory?.title);
    console.log('Upload Dialogues - Target Chapter:', targetChapter?.title);
    console.log('Upload Dialogues - Bulk Text Length:', bulkDialogues.trim().length);
    
    if (!targetStory || !bulkDialogues.trim()) {
      Alert.alert('Error', 'Please select a story and enter dialogues');
      return;
    }

    if (!targetChapter) {
      Alert.alert('Error', 'Please select a chapter to add dialogues to');
      return;
    }

    try {
      // Split by / to get individual dialogue blocks
      const dialogueBlocks = bulkDialogues.trim().split('/').filter(block => block.trim());
      console.log('Upload Dialogues - Dialogue Blocks Found:', dialogueBlocks.length);
      const questions: Question[] = [];

      for (const block of dialogueBlocks) {
        console.log('Upload Dialogues - Processing Block:', block.substring(0, 50) + '...');
        // Remove leading/trailing --- and split by ---
        const cleanBlock = block.replace(/^---|---$/g, '').trim();
        const parts = cleanBlock.split('---').filter(part => part.trim());
        
        console.log('Upload Dialogues - Parts Found:', parts.length);
        if (parts.length < 6) {
          console.log('Upload Dialogues - Skipping block with insufficient parts');
          continue;
        }

        const [
          npcInfo,
          correctAnswerWithEmoji,
          incorrectAnswer1WithEmoji,
          incorrectAnswer2WithEmoji,
          incorrectAnswer3WithEmoji,
          backgroundInfo
        ] = parts;

        if (!npcInfo || !correctAnswerWithEmoji) continue;

        // Parse NPC info (name-sentence-icon)
        const npcParts = npcInfo.split('-');
        const npcName = npcParts[0]?.trim() || '';
        const npcSentence = npcParts[1]?.trim() || '';
        const npcIcon = npcParts[2]?.trim() || '';

        // Parse answer-emoji pairs
        const parseAnswerEmoji = (text: string) => {
          const lastDashIndex = text.lastIndexOf('-');
          if (lastDashIndex === -1) return { answer: text.trim(), emoji: '' };
          
          const answer = text.substring(0, lastDashIndex).trim();
          const emoji = text.substring(lastDashIndex + 1).trim();
          return { answer, emoji };
        };

        // Parse background info (background-mood-description-with-emoji)
        const backgroundParts = backgroundInfo.split('-');
        const backgroundText = backgroundParts.slice(0, -1).join('-').trim();
        const moodWithEmoji = backgroundParts[backgroundParts.length - 1]?.trim() || '';
        
        // Parse mood description and emoji (e.g., "happy 😊" -> description: "happy", emoji: "😊")
        const moodParts = moodWithEmoji.split(' ');
        const moodDescription = moodParts.slice(0, -1).join(' ').trim() || 'neutral';
        const moodEmoji = moodParts[moodParts.length - 1]?.trim() || '';
        
        // Store the complete mood string (description + emoji) in moodEmoji field
        const completeMoodString = moodWithEmoji.trim();

        const correct = parseAnswerEmoji(correctAnswerWithEmoji);
        const incorrect1 = parseAnswerEmoji(incorrectAnswer1WithEmoji);
        const incorrect2 = parseAnswerEmoji(incorrectAnswer2WithEmoji);
        const incorrect3 = parseAnswerEmoji(incorrectAnswer3WithEmoji);

        const question = {
          id: Date.now().toString() + Math.random(),
          npcName: npcName,
          npcSentence: npcSentence,
          npcIcon: npcIcon,
          correctAnswer: correct.answer,
          correctEmoji: correct.emoji,
          incorrectAnswer1: incorrect1.answer,
          incorrectEmoji1: incorrect1.emoji,
          incorrectAnswer2: incorrect2.answer,
          incorrectEmoji2: incorrect2.emoji,
          incorrectAnswer3: incorrect3.answer,
          incorrectEmoji3: incorrect3.emoji,
          backgroundInfo: backgroundText,
          moodEmoji: completeMoodString, // Store complete mood string (description + emoji)
        };
        
        console.log('Upload Dialogues - Created Question:', question.npcName, question.npcSentence.substring(0, 30));
        questions.push(question);
      }

      console.log('Upload Dialogues - Total Questions Created:', questions.length);
      
      if (questions.length === 0) {
        Alert.alert('Error', 'No valid questions found in the bulk upload');
        return;
      }

      // Add questions to the selected chapter
      const storyRef = doc(db, 'stories', targetStory.id);
      const updatedChapters = targetStory.chapters.map(chapter => 
        chapter.id === targetChapter.id 
          ? { ...chapter, questions: [...chapter.questions, ...questions] }
          : chapter
      );

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      setBulkDialogues('');
      setShowBulkUpload(false);
      
      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story and chapter with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === targetStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
        const freshChapter = freshStory.chapters.find(c => c.id === targetChapter.id);
        if (freshChapter) {
          setSelectedChapter(freshChapter);
        }
      }
      
      Alert.alert('Success', `Added ${questions.length} questions to ${targetChapter.title} successfully`);
    } catch (error) {
      console.error('Error uploading dialogues:', error);
      Alert.alert('Error', 'Failed to upload dialogues');
    }
  };

  // Handler for bulk add vocabulary
  const handleBulkAddVocab = async () => {
    if (!selectedChapter || !bulkVocabText.trim()) return;
    
    try {
      console.log('Bulk Add Vocabulary - Starting...');
      console.log('Bulk Text Length:', bulkVocabText.length);
      
      // Parse bulkVocabText into vocab objects
      const blocks = bulkVocabText.split('/').map(b => b.trim()).filter(Boolean);
      console.log('Vocabulary Blocks Found:', blocks.length);
      
      const parsedVocab = blocks.map((block, index) => {
        console.log(`Processing Block ${index + 1}:`, block.substring(0, 50) + '...');
        
        // Split by '---' and filter out empty parts
        const parts = block.split('---').map(l => l.trim()).filter(Boolean);
        console.log(`Block ${index + 1} - Parts Found:`, parts.length);
        
        if (parts.length < 6) {
          console.log(`Block ${index + 1} - Skipping, insufficient parts`);
          return null;
        }
        
        const vocab = {
          word: parts[0],
          type: parts[1],
          definition: parts[2],
          example1: parts[3],
          example2: parts[4],
          equivalent: parts[5],
        };
        
        console.log(`Block ${index + 1} - Created vocab:`, vocab.word);
        return vocab;
      }).filter(Boolean);
      
      console.log('Total Vocabulary Created:', parsedVocab.length);
      
      if (parsedVocab.length === 0) {
        Alert.alert('Error', 'No valid vocabulary found. Please check the format.');
        return;
      }
      
      // Add vocabulary to the chapter
      const updatedChapters = selectedStory!.chapters.map(chapter => 
        chapter.id === selectedChapter.id 
          ? { ...chapter, vocabulary: [...(chapter.vocabulary || []), ...parsedVocab] }
          : chapter
      );
      
      await updateDoc(doc(db, 'stories', selectedStory!.id), {
        chapters: updatedChapters
      });
      
      setSelectedStory({ ...selectedStory!, chapters: updatedChapters });
      setSelectedChapter({ ...selectedChapter, vocabulary: [...(selectedChapter.vocabulary || []), ...parsedVocab] });
      setBulkVocabText('');
      setShowBulkVocabModal(false);
      
      await fetchStories();
      Alert.alert('Success', `Added ${parsedVocab.length} vocabulary words to chapter!`);
    } catch (error: any) {
      console.error('Error in handleBulkAddVocab:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', storyId));
      
      // Clear selections if the deleted story was selected
      if (selectedStory?.id === storyId) {
        setSelectedStory(null);
        setSelectedChapter(null);
      }
      if (editingStory?.id === storyId) {
        setEditingStory(null);
      }
      
      fetchStories();
      Alert.alert('Success', 'Story deleted successfully');
    } catch (error) {
      console.error('Error deleting story:', error);
      Alert.alert('Error', 'Failed to delete story');
    }
  };

  const handleEditStory = (story: Story) => {
    setEditingStory(story);
    setEditStoryTitle(story.title);
    setEditStoryDescription(story.description);
    setEditStoryLevel(story.level);
    setEditStoryEmoji(story.emoji);
    setEditStoryImageUrl(story.imageUrl || '');
  };

  const handleUpdateStory = async () => {
    if (!editingStory || !editStoryTitle.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    try {
      const storyRef = doc(db, 'stories', editingStory.id);
      await updateDoc(storyRef, {
        title: editStoryTitle.trim(),
        description: editStoryDescription.trim(),
        level: editStoryLevel,
        emoji: editStoryEmoji,
        imageUrl: editStoryImageUrl,
      });

      setEditingStory(null);
      setEditStoryTitle('');
      setEditStoryDescription('');
      setEditStoryLevel('');
      setEditStoryEmoji('');
      
      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === editingStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
      }
      
      Alert.alert('Success', 'Story updated successfully');
    } catch (error) {
      console.error('Error updating story:', error);
      Alert.alert('Error', 'Failed to update story');
    }
  };

  const handleCancelEdit = () => {
    setEditingStory(null);
    setEditStoryTitle('');
    setEditStoryDescription('');
    setEditStoryLevel('');
    setEditStoryEmoji('');
    setEditStoryImageUrl('');
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setEditChapterTitle(chapter.title);
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter || !editChapterTitle.trim() || !selectedStory) {
      Alert.alert('Error', 'Please enter a chapter title');
      return;
    }

    try {
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.map(chapter => 
        chapter.id === editingChapter.id 
          ? { ...chapter, title: editChapterTitle.trim() }
          : chapter
      );

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      setEditingChapter(null);
      setEditChapterTitle('');
      
      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story and chapter with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === selectedStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
        const freshChapter = freshStory.chapters.find(c => c.id === editingChapter.id);
        if (freshChapter) {
          setSelectedChapter(freshChapter);
        }
      }
      
      Alert.alert('Success', 'Chapter updated successfully');
    } catch (error) {
      console.error('Error updating chapter:', error);
      Alert.alert('Error', 'Failed to update chapter');
    }
  };

  const handleCancelChapterEdit = () => {
    setEditingChapter(null);
    setEditChapterTitle('');
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!selectedStory) return;

    try {
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.filter(chapter => chapter.id !== chapterId);
      
      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      if (selectedChapter?.id === chapterId) {
        setSelectedChapter(null);
      }
      
      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === selectedStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
      }
      
      Alert.alert('Success', 'Chapter deleted successfully');
    } catch (error) {
      console.error('Error deleting chapter:', error);
      Alert.alert('Error', 'Failed to delete chapter');
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setEditQuestionNpc(question.npcSentence);
    setEditQuestionCorrect(question.correctAnswer);
    setEditQuestionCorrectEmoji(question.correctEmoji);
    setEditQuestionIncorrect1(question.incorrectAnswer1);
    setEditQuestionIncorrectEmoji1(question.incorrectEmoji1);
    setEditQuestionIncorrect2(question.incorrectAnswer2);
    setEditQuestionIncorrectEmoji2(question.incorrectEmoji2);
    setEditQuestionIncorrect3(question.incorrectAnswer3);
    setEditQuestionIncorrectEmoji3(question.incorrectEmoji3);
    setEditQuestionMood(question.backgroundInfo);
    setEditQuestionMoodEmoji(question.moodEmoji);
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !selectedStory || !selectedChapter) return;

    try {
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.map(chapter => {
        if (chapter.id === selectedChapter.id) {
          const updatedQuestions = chapter.questions.map(question => 
            question.id === editingQuestion.id 
              ? {
                  ...question,
                  npcSentence: editQuestionNpc,
                  correctAnswer: editQuestionCorrect,
                  correctEmoji: editQuestionCorrectEmoji,
                  incorrectAnswer1: editQuestionIncorrect1,
                  incorrectEmoji1: editQuestionIncorrectEmoji1,
                  incorrectAnswer2: editQuestionIncorrect2,
                  incorrectEmoji2: editQuestionIncorrectEmoji2,
                  incorrectAnswer3: editQuestionIncorrect3,
                  incorrectEmoji3: editQuestionIncorrectEmoji3,
                  backgroundInfo: editQuestionMood,
                  moodEmoji: editQuestionMoodEmoji,
                }
              : question
          );
          return { ...chapter, questions: updatedQuestions };
        }
        return chapter;
      });

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      setEditingQuestion(null);
      setEditQuestionNpc('');
      setEditQuestionCorrect('');
      setEditQuestionCorrectEmoji('');
      setEditQuestionIncorrect1('');
      setEditQuestionIncorrectEmoji1('');
      setEditQuestionIncorrect2('');
      setEditQuestionIncorrectEmoji2('');
      setEditQuestionIncorrect3('');
      setEditQuestionIncorrectEmoji3('');
      setEditQuestionMood('');
      setEditQuestionMoodEmoji('');
      
      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story and chapter with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === selectedStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
        const freshChapter = freshStory.chapters.find(c => c.id === selectedChapter.id);
        if (freshChapter) {
          setSelectedChapter(freshChapter);
        }
      }
      
      Alert.alert('Success', 'Question updated successfully');
    } catch (error) {
      console.error('Error updating question:', error);
      Alert.alert('Error', 'Failed to update question');
    }
  };

  const handleCancelQuestionEdit = () => {
    setEditingQuestion(null);
    setEditQuestionNpc('');
    setEditQuestionCorrect('');
    setEditQuestionCorrectEmoji('');
    setEditQuestionIncorrect1('');
    setEditQuestionIncorrectEmoji1('');
    setEditQuestionIncorrect2('');
    setEditQuestionIncorrectEmoji2('');
    setEditQuestionIncorrect3('');
    setEditQuestionIncorrectEmoji3('');
    setEditQuestionMood('');
    setEditQuestionMoodEmoji('');
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedStory || !selectedChapter) return;

    try {
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.map(chapter => {
        if (chapter.id === selectedChapter.id) {
          const updatedQuestions = chapter.questions.filter(question => question.id !== questionId);
          return { ...chapter, questions: updatedQuestions };
        }
        return chapter;
      });

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      // Fetch updated stories and update selected states
      await fetchStories();
      
      // Update selected story and chapter with fresh data
      const updatedStories = await getDocs(collection(db, 'stories'));
      const freshStoryData = updatedStories.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      const freshStory = freshStoryData.find(s => s.id === selectedStory.id);
      if (freshStory) {
        setSelectedStory(freshStory);
        const freshChapter = freshStory.chapters.find(c => c.id === selectedChapter.id);
        if (freshChapter) {
          setSelectedChapter(freshChapter);
        }
      }
      
      Alert.alert('Success', 'Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      Alert.alert('Error', 'Failed to delete question');
    }
  };

  const handleToggleStoryActive = async (story: Story) => {
    try {
      const storyRef = doc(db, 'stories', story.id);
      await updateDoc(storyRef, {
        active: !story.active
      });
      
      await fetchStories();
      Alert.alert('Success', `Story ${story.active ? 'deactivated' : 'activated'} successfully`);
    } catch (error) {
      console.error('Error toggling story active status:', error);
      Alert.alert('Error', 'Failed to update story status');
    }
  };

  const handleToggleChapterActive = async (chapter: Chapter) => {
    if (!selectedStory) return;

    try {
      console.log('Toggling chapter active status:', chapter.title, 'Current active:', chapter.active);
      
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.map(ch => {
        if (ch.id === chapter.id) {
          const newActiveStatus = !ch.active;
          console.log('Updating chapter:', ch.title, 'New active status:', newActiveStatus);
          return { ...ch, active: newActiveStatus };
        }
        return ch;
      });

      console.log('Updated chapters:', updatedChapters.map(ch => ({ title: ch.title, active: ch.active })));

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === chapter.id);
      if (updatedChapter) {
        setSelectedChapter(updatedChapter);
      }
      
      await fetchStories();
      Alert.alert('Success', `Chapter ${chapter.active ? 'deactivated' : 'activated'} successfully`);
    } catch (error) {
      console.error('Error toggling chapter active status:', error);
      Alert.alert('Error', 'Failed to update chapter status');
    }
  };

  const handleEditVocab = (vocab: any) => {
    setEditingVocab(vocab);
    setEditVocabWord(vocab.word || '');
    setEditVocabType(vocab.type || '');
    setEditVocabDefinition(vocab.definition || '');
    setEditVocabExample1(vocab.example1 || '');
    setEditVocabExample2(vocab.example2 || '');
    setEditVocabEquivalent(vocab.equivalent || '');
  };

  const handleUpdateVocab = async () => {
    if (!selectedStory || !selectedChapter || !editingVocab) return;

    try {
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.map(chapter => {
        if (chapter.id === selectedChapter.id) {
          const updatedVocab = chapter.vocabulary?.map((vocab: any) => {
            if (vocab.word === editingVocab.word) {
              return {
                word: editVocabWord,
                type: editVocabType,
                definition: editVocabDefinition,
                example1: editVocabExample1,
                example2: editVocabExample2,
                equivalent: editVocabEquivalent,
              };
            }
            return vocab;
          }) || [];
          return { ...chapter, vocabulary: updatedVocab };
        }
        return chapter;
      });

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      if (updatedChapter) {
        setSelectedChapter(updatedChapter);
      }

      setEditingVocab(null);
      setEditVocabWord('');
      setEditVocabType('');
      setEditVocabDefinition('');
      setEditVocabExample1('');
      setEditVocabExample2('');
      setEditVocabEquivalent('');

      await fetchStories();
      Alert.alert('Success', 'Vocabulary updated successfully');
    } catch (error) {
      console.error('Error updating vocabulary:', error);
      Alert.alert('Error', 'Failed to update vocabulary');
    }
  };

  const handleDeleteVocab = async (vocabToDelete: any) => {
    if (!selectedStory || !selectedChapter) return;

    try {
      const storyRef = doc(db, 'stories', selectedStory.id);
      const updatedChapters = selectedStory.chapters.map(chapter => {
        if (chapter.id === selectedChapter.id) {
          const updatedVocab = chapter.vocabulary?.filter((vocab: any) => vocab.word !== vocabToDelete.word) || [];
          return { ...chapter, vocabulary: updatedVocab };
        }
        return chapter;
      });

      await updateDoc(storyRef, {
        chapters: updatedChapters,
      });

      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      if (updatedChapter) {
        setSelectedChapter(updatedChapter);
      }

      await fetchStories();
      Alert.alert('Success', 'Vocabulary deleted successfully');
    } catch (error) {
      console.error('Error deleting vocabulary:', error);
      Alert.alert('Error', 'Failed to delete vocabulary');
    }
  };

  const handleCancelVocabEdit = () => {
    setEditingVocab(null);
    setEditVocabWord('');
    setEditVocabType('');
    setEditVocabDefinition('');
    setEditVocabExample1('');
    setEditVocabExample2('');
    setEditVocabEquivalent('');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
          Loading Admin Panel...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
          Story Admin Panel
        </Text>
        <TouchableOpacity 
          style={styles.messageButton}
          onPress={() => {
            // Navigate to messages screen or show messages modal
            Alert.alert('Messages', `You have ${pendingMessagesCount} pending support messages`);
          }}
        >
          <Text style={styles.messageButtonText}>💬 Messages</Text>
          {pendingMessagesCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>
                {pendingMessagesCount > 99 ? '99+' : pendingMessagesCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Left Panel - Story Management */}
        <ScrollView style={[styles.leftPanel, { backgroundColor: theme.cardColor }]} showsVerticalScrollIndicator={true}>
          {editingStory ? (
            // Edit Story Form
            <>
              <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
                Edit Story: {editingStory.title}
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                  Story Title:
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.surfaceColor, 
                    color: theme.primaryText,
                    borderColor: theme.borderColor,
                    fontSize: getScaledFontSize(16)
                  }]}
                  value={editStoryTitle}
                  onChangeText={setEditStoryTitle}
                  placeholder="Enter story title"
                  placeholderTextColor={theme.secondaryText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                  Description:
                </Text>
                <TextInput
                  style={[styles.textArea, { 
                    backgroundColor: theme.surfaceColor, 
                    color: theme.primaryText,
                    borderColor: theme.borderColor,
                    fontSize: getScaledFontSize(16)
                  }]}
                  value={editStoryDescription}
                  onChangeText={setEditStoryDescription}
                  placeholder="Enter story description"
                  placeholderTextColor={theme.secondaryText}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    Level:
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surfaceColor, 
                      color: theme.primaryText,
                      borderColor: theme.borderColor,
                      fontSize: getScaledFontSize(16)
                    }]}
                    value={editStoryLevel}
                    onChangeText={setEditStoryLevel}
                    placeholder="Easy, Medium, Hard"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    Emoji:
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surfaceColor, 
                      color: theme.primaryText,
                      borderColor: theme.borderColor,
                      fontSize: getScaledFontSize(16)
                    }]}
                    value={editStoryEmoji}
                    onChangeText={setEditStoryEmoji}
                    placeholder="📚"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    Image URL:
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surfaceColor, 
                      color: theme.primaryText,
                      borderColor: theme.borderColor,
                      fontSize: getScaledFontSize(16)
                    }]}
                    value={editStoryImageUrl}
                    onChangeText={setEditStoryImageUrl}
                    placeholder="https://example.com/image.jpg"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.primary, flex: 1, marginRight: 8 }]}
                  onPress={handleUpdateStory}
                >
                  <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                    Update Story
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.error, flex: 1, marginLeft: 8 }]}
                  onPress={handleCancelEdit}
                >
                  <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Create Story Form
            <>
              <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
                Create New Story
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                  Story Title:
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.surfaceColor, 
                    color: theme.primaryText,
                    borderColor: theme.borderColor,
                    fontSize: getScaledFontSize(16)
                  }]}
                  value={newStoryTitle}
                  onChangeText={setNewStoryTitle}
                  placeholder="Enter story title"
                  placeholderTextColor={theme.secondaryText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                  Description:
                </Text>
                <TextInput
                  style={[styles.textArea, { 
                    backgroundColor: theme.surfaceColor, 
                    color: theme.primaryText,
                    borderColor: theme.borderColor,
                    fontSize: getScaledFontSize(16)
                  }]}
                  value={newStoryDescription}
                  onChangeText={setNewStoryDescription}
                  placeholder="Enter story description"
                  placeholderTextColor={theme.secondaryText}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    Level:
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surfaceColor, 
                      color: theme.primaryText,
                      borderColor: theme.borderColor,
                      fontSize: getScaledFontSize(16)
                    }]}
                    value={newStoryLevel}
                    onChangeText={setNewStoryLevel}
                    placeholder="Easy, Medium, Hard"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    Image URL:
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surfaceColor, 
                      color: theme.primaryText,
                      borderColor: theme.borderColor,
                      fontSize: getScaledFontSize(16)
                    }]}
                    value={newStoryImageUrl}
                    onChangeText={setNewStoryImageUrl}
                    placeholder="https://raw.githubusercontent.com/your-repo/images/story-image.jpg"
                    placeholderTextColor={theme.secondaryText}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={handleCreateStory}
              >
                <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                  Create Story
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.divider} />

          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            Add Chapter
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
              Chapter Title:
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surfaceColor, 
                color: theme.primaryText,
                borderColor: theme.borderColor,
                fontSize: getScaledFontSize(16)
              }]}
              value={newChapterTitle}
              onChangeText={setNewChapterTitle}
              placeholder="Enter chapter title"
              placeholderTextColor={theme.secondaryText}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.success }]}
            onPress={handleAddChapter}
            disabled={!selectedStory}
          >
            <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
              Add Chapter
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            Bulk Upload Dialogues
          </Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => setShowBulkUpload(!showBulkUpload)}
            disabled={!selectedStory}
          >
            <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
              {showBulkUpload ? 'Hide' : 'Show'} Bulk Upload
            </Text>
          </TouchableOpacity>

          {showBulkUpload && (
            <View style={styles.bulkUploadSection}>
              <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                Format: ---npc sentence---correct answer-emoji---incorrect1-emoji---incorrect2-emoji---incorrect3-emoji---mood-emoji
              </Text>
              <TextInput
                style={[styles.textArea, { 
                  backgroundColor: theme.surfaceColor, 
                  color: theme.primaryText,
                  borderColor: theme.borderColor,
                  fontSize: getScaledFontSize(14),
                  height: 200
                }]}
                value={bulkDialogues}
                onChangeText={setBulkDialogues}
                placeholder="Paste your dialogues here..."
                placeholderTextColor={theme.secondaryText}
                multiline
                numberOfLines={10}
              />
              <TouchableOpacity
                style={[styles.button, { 
                  backgroundColor: selectedStory && selectedChapter ? theme.success : theme.error 
                }]}
                onPress={handleBulkUploadDialogues}
                disabled={!selectedStory || !selectedChapter}
              >
                <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                  Upload Dialogues {!selectedStory ? '(Select Story)' : !selectedChapter ? '(Select Chapter)' : ''}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            Bulk Add Vocabulary
          </Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => setShowBulkVocabModal(!showBulkVocabModal)}
            disabled={!selectedStory}
          >
            <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
              {showBulkVocabModal ? 'Hide' : 'Show'} Bulk Vocabulary
            </Text>
          </TouchableOpacity>

          {showBulkVocabModal && (
            <View style={styles.bulkUploadSection}>
              <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                Format: ---word---type of speech---definition---example sentence1---example sentence2---equivalent---/
              </Text>
              <TextInput
                style={[styles.textArea, { 
                  backgroundColor: theme.surfaceColor, 
                  color: theme.primaryText,
                  borderColor: theme.borderColor,
                  fontSize: getScaledFontSize(14),
                  height: 200
                }]}
                value={bulkVocabText}
                onChangeText={setBulkVocabText}
                placeholder="---create---verb-to make something out of nothing or with some materials--He created a masterpiece.--We need to create new ways of doing it.--yaratmak--/"
                placeholderTextColor={theme.secondaryText}
                multiline
                numberOfLines={10}
              />
              <TouchableOpacity
                style={[
                  styles.button, 
                  { 
                    backgroundColor: selectedChapter && bulkVocabText.trim() ? theme.success : theme.secondaryText 
                  }
                ]}
                onPress={handleBulkAddVocab}
                disabled={!selectedChapter || !bulkVocabText.trim()}
              >
                <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                  {!selectedChapter ? 'Select a Chapter First' : 
                   !bulkVocabText.trim() ? 'Enter Vocabulary Text' : 
                   'Add Vocabulary'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Right Panel - Story List and Details */}
        <ScrollView style={[styles.rightPanel, { backgroundColor: theme.cardColor }]} showsVerticalScrollIndicator={true}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            Stories ({stories.length})
          </Text>

          <View style={styles.storyList}>
            {stories.map((story) => (
              <TouchableOpacity
                key={story.id}
                style={[
                  styles.storyItem,
                  { 
                    backgroundColor: selectedStory?.id === story.id ? theme.primary : theme.surfaceColor,
                    borderColor: theme.borderColor
                  }
                ]}
                onPress={() => setSelectedStory(story)}
              >
                <View style={styles.storyHeader}>
                  {(story.imageUrl || (story.emoji && story.emoji.startsWith('http'))) ? (
                    <Image 
                      source={{ uri: story.imageUrl || story.emoji }} 
                      style={styles.storyImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[styles.storyEmoji, { fontSize: getScaledFontSize(24) }]}>
                      {story.emoji}
                    </Text>
                  )}
                  <View style={styles.storyInfo}>
                    <Text style={[styles.storyTitle, { 
                      color: selectedStory?.id === story.id ? '#fff' : theme.primaryText,
                      fontSize: getScaledFontSize(16)
                    }]}>
                      {story.title}
                    </Text>
                    <Text style={[styles.storyLevel, { 
                      color: selectedStory?.id === story.id ? '#fff' : theme.secondaryText,
                      fontSize: getScaledFontSize(14)
                    }]}>
                      {story.level}
                    </Text>
                  </View>
                  <View style={styles.storyActions}>
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleEditStory(story)}
                    >
                      <Text style={[styles.editButtonText, { color: '#fff', fontSize: getScaledFontSize(12) }]}>
                        Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.activeButton, { backgroundColor: story.active ? theme.success : theme.warning }]}
                      onPress={() => handleToggleStoryActive(story)}
                    >
                      <Text style={[styles.activeButtonText, { color: '#fff', fontSize: getScaledFontSize(12) }]}>
                        {story.active ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteButton, { backgroundColor: theme.error }]}
                      onPress={() => handleDeleteStory(story.id)}
                    >
                      <Text style={[styles.deleteButtonText, { color: '#fff', fontSize: getScaledFontSize(12) }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected Story Details */}
          {selectedStory && (
            <View style={styles.storyDetails}>
              <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
                {selectedStory.title} Details
              </Text>
              
              <Text style={[styles.detailText, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                Chapters: {selectedStory.chapters.length}
              </Text>
              
              <Text style={[styles.detailText, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                Total Questions: {selectedStory.chapters.reduce((total, chapter) => total + chapter.questions.length, 0)}
              </Text>

              {/* Chapter Selection */}
              <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(16), marginTop: 20 }]}>
                Chapters
              </Text>
              
              <View style={styles.chapterList}>
                {selectedStory.chapters.map((chapter) => (
                  <TouchableOpacity
                    key={chapter.id}
                    style={[
                      styles.chapterItem,
                      { 
                        backgroundColor: selectedChapter?.id === chapter.id ? theme.primary : theme.surfaceColor,
                        borderColor: theme.borderColor
                      }
                    ]}
                    onPress={() => setSelectedChapter(chapter)}
                  >
                    <View style={styles.chapterHeader}>
                      <View style={styles.chapterInfo}>
                        <Text style={[styles.chapterTitle, { 
                          color: selectedChapter?.id === chapter.id ? '#fff' : theme.primaryText,
                          fontSize: getScaledFontSize(14)
                        }]}>
                          {editingChapter?.id === chapter.id ? (
                            <TextInput
                              style={[styles.chapterTitleInput, { 
                                color: selectedChapter?.id === chapter.id ? '#fff' : theme.primaryText,
                                fontSize: getScaledFontSize(14)
                              }]}
                              value={editChapterTitle}
                              onChangeText={setEditChapterTitle}
                              placeholder="Chapter title"
                              placeholderTextColor={theme.secondaryText}
                            />
                          ) : (
                            chapter.title
                          )}
                        </Text>
                        <Text style={[styles.chapterQuestions, { 
                          color: selectedChapter?.id === chapter.id ? '#fff' : theme.secondaryText,
                          fontSize: getScaledFontSize(12)
                        }]}>
                          {chapter.questions.length} questions
                        </Text>
                      </View>
                      <View style={styles.chapterActions}>
                        {editingChapter?.id === chapter.id ? (
                          <>
                            <TouchableOpacity
                              style={[styles.chapterActionButton, { backgroundColor: theme.success }]}
                              onPress={handleUpdateChapter}
                            >
                              <Text style={[styles.chapterActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                Save
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.chapterActionButton, { backgroundColor: theme.error }]}
                              onPress={handleCancelChapterEdit}
                            >
                              <Text style={[styles.chapterActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={[styles.chapterActionButton, { backgroundColor: theme.primary }]}
                              onPress={() => handleEditChapter(chapter)}
                            >
                              <Text style={[styles.chapterActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                Edit
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.chapterActionButton, { backgroundColor: chapter.active ? theme.success : theme.warning }]}
                              onPress={() => handleToggleChapterActive(chapter)}
                            >
                              <Text style={[styles.chapterActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                {chapter.active ? 'Active' : 'Inactive'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.chapterActionButton, { backgroundColor: theme.error }]}
                              onPress={() => handleDeleteChapter(chapter.id)}
                            >
                              <Text style={[styles.chapterActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                Delete
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Show questions for selected chapter only */}
              {selectedChapter && (
                <View style={styles.questionsList}>
                  <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(16), marginBottom: 16 }]}>
                    Questions in {selectedChapter.title} ({selectedChapter.questions.length} questions)
                  </Text>
                  
                  {selectedChapter.questions.map((question, questionIndex) => (
                    <View key={question.id} style={[styles.questionCard, { backgroundColor: theme.surfaceColor }]}>
                      {editingQuestion?.id === question.id ? (
                        // Edit Question Form
                        <View style={styles.questionEditForm}>
                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              NPC Sentence:
                            </Text>
                            <TextInput
                              style={[styles.input, { 
                                backgroundColor: theme.backgroundColor, 
                                color: theme.primaryText,
                                borderColor: theme.borderColor,
                                fontSize: getScaledFontSize(14)
                              }]}
                              value={editQuestionNpc}
                              onChangeText={setEditQuestionNpc}
                              placeholder="NPC sentence"
                              placeholderTextColor={theme.secondaryText}
                            />
                          </View>

                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              Correct Answer:
                            </Text>
                            <View style={styles.row}>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  flex: 1,
                                  marginRight: 8
                                }]}
                                value={editQuestionCorrect}
                                onChangeText={setEditQuestionCorrect}
                                placeholder="Correct answer"
                                placeholderTextColor={theme.secondaryText}
                              />
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  width: 60
                                }]}
                                value={editQuestionCorrectEmoji}
                                onChangeText={setEditQuestionCorrectEmoji}
                                placeholder="🙂"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>
                          </View>

                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              Incorrect Answer 1:
                            </Text>
                            <View style={styles.row}>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  flex: 1,
                                  marginRight: 8
                                }]}
                                value={editQuestionIncorrect1}
                                onChangeText={setEditQuestionIncorrect1}
                                placeholder="Incorrect answer 1"
                                placeholderTextColor={theme.secondaryText}
                              />
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  width: 60
                                }]}
                                value={editQuestionIncorrectEmoji1}
                                onChangeText={setEditQuestionIncorrectEmoji1}
                                placeholder="😡"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>
                          </View>

                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              Incorrect Answer 2:
                            </Text>
                            <View style={styles.row}>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  flex: 1,
                                  marginRight: 8
                                }]}
                                value={editQuestionIncorrect2}
                                onChangeText={setEditQuestionIncorrect2}
                                placeholder="Incorrect answer 2"
                                placeholderTextColor={theme.secondaryText}
                              />
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  width: 60
                                }]}
                                value={editQuestionIncorrectEmoji2}
                                onChangeText={setEditQuestionIncorrectEmoji2}
                                placeholder="😐"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>
                          </View>

                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              Incorrect Answer 3:
                            </Text>
                            <View style={styles.row}>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  flex: 1,
                                  marginRight: 8
                                }]}
                                value={editQuestionIncorrect3}
                                onChangeText={setEditQuestionIncorrect3}
                                placeholder="Incorrect answer 3"
                                placeholderTextColor={theme.secondaryText}
                              />
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  width: 60
                                }]}
                                value={editQuestionIncorrectEmoji3}
                                onChangeText={setEditQuestionIncorrectEmoji3}
                                placeholder="😭"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>
                          </View>

                          <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              Character Mood:
                            </Text>
                            <View style={styles.row}>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  flex: 1,
                                  marginRight: 8
                                }]}
                                value={editQuestionMood}
                                onChangeText={setEditQuestionMood}
                                placeholder="Character mood"
                                placeholderTextColor={theme.secondaryText}
                              />
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14),
                                  width: 60
                                }]}
                                value={editQuestionMoodEmoji}
                                onChangeText={setEditQuestionMoodEmoji}
                                placeholder="🙂"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>
                          </View>

                          <View style={styles.buttonRow}>
                            <TouchableOpacity
                              style={[styles.button, { backgroundColor: theme.success, flex: 1, marginRight: 8 }]}
                              onPress={handleUpdateQuestion}
                            >
                              <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(14) }]}>
                                Save Question
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.button, { backgroundColor: theme.error, flex: 1, marginLeft: 8 }]}
                              onPress={handleCancelQuestionEdit}
                            >
                              <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(14) }]}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        // Display Question
                        <>
                          <View style={styles.questionHeader}>
                            <Text style={[styles.questionDisplayText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                              <Text style={{ fontWeight: 'bold' }}>Q{questionIndex + 1}:</Text> {question.npcSentence}
                            </Text>
                            <View style={styles.questionActions}>
                              <TouchableOpacity
                                style={[styles.questionActionButton, { backgroundColor: theme.primary }]}
                                onPress={() => handleEditQuestion(question)}
                              >
                                <Text style={[styles.questionActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                  Edit
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.questionActionButton, { backgroundColor: theme.error }]}
                                onPress={() => handleDeleteQuestion(question.id)}
                              >
                                <Text style={[styles.questionActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                  Delete
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          
                          <View style={styles.answersList}>
                            <Text style={[styles.answerText, { color: theme.success, fontSize: getScaledFontSize(12) }]}>
                              ✓ {question.correctAnswer} {question.correctEmoji}
                            </Text>
                            <Text style={[styles.answerText, { color: theme.error, fontSize: getScaledFontSize(12) }]}>
                              ✗ {question.incorrectAnswer1} {question.incorrectEmoji1}
                            </Text>
                            <Text style={[styles.answerText, { color: theme.error, fontSize: getScaledFontSize(12) }]}>
                              ✗ {question.incorrectAnswer2} {question.incorrectEmoji2}
                            </Text>
                            <Text style={[styles.answerText, { color: theme.error, fontSize: getScaledFontSize(12) }]}>
                              ✗ {question.incorrectAnswer3} {question.incorrectEmoji3}
                            </Text>
                          </View>
                          
                          <Text style={[styles.moodText, { color: theme.primary, fontSize: getScaledFontSize(12) }]}>
                            Background: {question.backgroundInfo} {question.moodEmoji}
                          </Text>
                        </>
                      )}
                    </View>
                  ))}

                  {/* Vocabulary Section */}
                  <View style={styles.vocabularyList}>
                    <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(16), marginBottom: 16 }]}>
                      Vocabulary in {selectedChapter.title} ({selectedChapter.vocabulary?.length || 0} words)
                    </Text>
                    
                    {selectedChapter.vocabulary?.map((vocab: any, vocabIndex: number) => (
                      <View key={vocabIndex} style={[styles.vocabCard, { backgroundColor: theme.surfaceColor }]}>
                        {editingVocab?.word === vocab.word ? (
                          // Edit Vocabulary Form
                          <View style={styles.vocabEditForm}>
                            <View style={styles.inputGroup}>
                              <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                Word:
                              </Text>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14)
                                }]}
                                value={editVocabWord}
                                onChangeText={setEditVocabWord}
                                placeholder="Enter word"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                Type:
                              </Text>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14)
                                }]}
                                value={editVocabType}
                                onChangeText={setEditVocabType}
                                placeholder="noun, verb, adjective, etc."
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                Definition:
                              </Text>
                              <TextInput
                                style={[styles.textArea, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14)
                                }]}
                                value={editVocabDefinition}
                                onChangeText={setEditVocabDefinition}
                                placeholder="Enter definition"
                                placeholderTextColor={theme.secondaryText}
                                multiline
                                numberOfLines={2}
                              />
                            </View>

                            <View style={styles.row}>
                              <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                  Example 1:
                                </Text>
                                <TextInput
                                  style={[styles.input, { 
                                    backgroundColor: theme.backgroundColor, 
                                    color: theme.primaryText,
                                    borderColor: theme.borderColor,
                                    fontSize: getScaledFontSize(14)
                                  }]}
                                  value={editVocabExample1}
                                  onChangeText={setEditVocabExample1}
                                  placeholder="First example"
                                  placeholderTextColor={theme.secondaryText}
                                />
                              </View>
                              <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                  Example 2:
                                </Text>
                                <TextInput
                                  style={[styles.input, { 
                                    backgroundColor: theme.backgroundColor, 
                                    color: theme.primaryText,
                                    borderColor: theme.borderColor,
                                    fontSize: getScaledFontSize(14)
                                  }]}
                                  value={editVocabExample2}
                                  onChangeText={setEditVocabExample2}
                                  placeholder="Second example"
                                  placeholderTextColor={theme.secondaryText}
                                />
                              </View>
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={[styles.label, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                Equivalent:
                              </Text>
                              <TextInput
                                style={[styles.input, { 
                                  backgroundColor: theme.backgroundColor, 
                                  color: theme.primaryText,
                                  borderColor: theme.borderColor,
                                  fontSize: getScaledFontSize(14)
                                }]}
                                value={editVocabEquivalent}
                                onChangeText={setEditVocabEquivalent}
                                placeholder="Turkish equivalent"
                                placeholderTextColor={theme.secondaryText}
                              />
                            </View>

                            <View style={styles.buttonRow}>
                              <TouchableOpacity
                                style={[styles.button, { backgroundColor: theme.success, flex: 1, marginRight: 8 }]}
                                onPress={handleUpdateVocab}
                              >
                                <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(14) }]}>
                                  Save Vocabulary
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.button, { backgroundColor: theme.error, flex: 1, marginLeft: 8 }]}
                                onPress={handleCancelVocabEdit}
                              >
                                <Text style={[styles.buttonText, { color: '#fff', fontSize: getScaledFontSize(14) }]}>
                                  Cancel
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          // Display Vocabulary
                          <>
                            <View style={styles.vocabHeader}>
                              <Text style={[styles.vocabDisplayText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                <Text style={{ fontWeight: 'bold' }}>{vocab.word}</Text> ({vocab.type})
                              </Text>
                              <View style={styles.vocabActions}>
                                <TouchableOpacity
                                  style={[styles.vocabActionButton, { backgroundColor: theme.primary }]}
                                  onPress={() => handleEditVocab(vocab)}
                                >
                                  <Text style={[styles.vocabActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                    Edit
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.vocabActionButton, { backgroundColor: theme.error }]}
                                  onPress={() => handleDeleteVocab(vocab)}
                                >
                                  <Text style={[styles.vocabActionText, { color: '#fff', fontSize: getScaledFontSize(10) }]}>
                                    Delete
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                            
                            <Text style={[styles.vocabDefinition, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>
                              {vocab.definition}
                            </Text>
                            
                            <View style={styles.vocabExamples}>
                              <Text style={[styles.vocabExample, { color: theme.primary, fontSize: getScaledFontSize(12) }]}>
                                • {vocab.example1}
                              </Text>
                              <Text style={[styles.vocabExample, { color: theme.primary, fontSize: getScaledFontSize(12) }]}>
                                • {vocab.example2}
                              </Text>
                            </View>
                            
                            <Text style={[styles.vocabEquivalent, { color: theme.success, fontSize: getScaledFontSize(12) }]}>
                              = {vocab.equivalent}
                            </Text>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                </View>

              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  leftPanel: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    maxWidth: 400,
    maxHeight: '100%',
  },
  rightPanel: {
    flex: 2,
    padding: 20,
    borderRadius: 12,
    maxHeight: '100%',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 20,
  },
  bulkUploadSection: {
    marginTop: 16,
  },
  storyList: {
    marginBottom: 20,
  },
  storyItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyEmoji: {
    marginRight: 12,
  },
  storyImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    fontWeight: 'bold',
  },
  storyLevel: {
    marginTop: 4,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    fontWeight: 'bold',
  },
  storyDetails: {
    marginTop: 20,
  },
  detailText: {
    marginBottom: 8,
  },
  questionsList: {
    marginTop: 16,
  },
  chapterSection: {
    marginBottom: 20,
  },
  chapterSectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  questionCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  questionDisplayText: {
    marginBottom: 8,
  },
  answersList: {
    marginBottom: 8,
  },
  answerText: {
    marginBottom: 4,
  },
  moodText: {
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  storyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    fontWeight: 'bold',
  },
  activeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeButtonText: {
    fontWeight: 'bold',
  },
  chapterList: {
    marginTop: 16,
  },
  chapterItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontWeight: 'bold',
  },
  chapterTitleInput: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 4,
    fontSize: 14,
  },
  chapterQuestions: {
    marginTop: 4,
  },
  chapterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chapterActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chapterActionText: {
    fontWeight: 'bold',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionText: {
    flex: 1,
  },
  questionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  questionActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  questionActionText: {
    fontWeight: 'bold',
  },
  questionEditForm: {
    marginTop: 8,
  },
  vocabularyList: {
    marginTop: 20,
  },
  vocabCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  vocabEditForm: {
    marginTop: 8,
  },
  vocabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vocabDisplayText: {
    flex: 1,
  },
  vocabActions: {
    flexDirection: 'row',
    gap: 8,
  },
  vocabActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vocabActionText: {
    fontWeight: 'bold',
  },
  vocabDefinition: {
    marginBottom: 8,
    lineHeight: 16,
  },
  vocabExamples: {
    marginBottom: 8,
  },
  vocabExample: {
    marginBottom: 4,
  },
  vocabEquivalent: {
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  messageButton: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default WebAdminPanel; 