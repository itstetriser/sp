import { useNavigation } from '@react-navigation/native';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface FlowQuestion { id: string; npcName: string; npcSentence: string; npcIcon: string; correctAnswer: string; correctEmoji: string; incorrectAnswer1: string; incorrectEmoji1: string; incorrectAnswer2: string; incorrectEmoji2: string; incorrectAnswer3: string; incorrectEmoji3: string; backgroundInfo?: string; }
interface FlowChapter { id: string; title: string; active?: boolean; order?: number; questions: FlowQuestion[]; vocabulary?: any[]; background?: string; }
interface FlowStory { id: string; title: string; description: string; level: string; emoji: string; imageUrl?: string; active?: boolean; chapters: FlowChapter[]; }

type AnswerKey = 'A' | 'B' | 'C' | 'D';
interface EditedQuestionView {
  id: string;
  npcName: string;
  npcSentence: string;
  npcIcon: string;
  a: string; b: string; c: string; d: string;
  aEmoji: string; bEmoji: string; cEmoji: string; dEmoji: string;
  correctKey: AnswerKey;
}

interface Option {
  text: string;
  emoji: string;
  correct: boolean;
}

const FlowAdminPanel = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();
  const [stories, setStories] = useState<FlowStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<FlowStory | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<FlowChapter | null>(null);

  // create story form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('Easy');
  const [imageUrl, setImageUrl] = useState('');
  const [emoji, setEmoji] = useState('📘');

  // chapter
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [chapterBackground, setChapterBackground] = useState('');

  // bulk dialogues
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkDialogues, setBulkDialogues] = useState('');

  // bulk vocab
  const [showBulkVocab, setShowBulkVocab] = useState(false);
  const [bulkVocabText, setBulkVocabText] = useState('');

  // bulk chapters
  const [showBulkChapters, setShowBulkChapters] = useState(false);
  const [bulkChaptersText, setBulkChaptersText] = useState('');

  // story edit state
  const [storyTitleEdit, setStoryTitleEdit] = useState('');
  const [storyDescriptionEdit, setStoryDescriptionEdit] = useState('');
  const [storyLevelEdit, setStoryLevelEdit] = useState('');
  const [storyImageUrlEdit, setStoryImageUrlEdit] = useState('');
  const [storyEmojiEdit, setStoryEmojiEdit] = useState('');
  const [storyActiveEdit, setStoryActiveEdit] = useState<boolean>(true);

  // chapter edit state
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterActive, setEditChapterActive] = useState<boolean>(true);
  const [editChapterOrder, setEditChapterOrder] = useState<string>('');

  // inline edited questions state (not shown by default, we use card editing below)
  const [editedQuestions, setEditedQuestions] = useState<Record<string, EditedQuestionView>>({});

  // question card editing
  const [editingQuestion, setEditingQuestion] = useState<FlowQuestion | null>(null);
  const [editNpcName, setEditNpcName] = useState('');
  const [editNpcSentence, setEditNpcSentence] = useState('');
  const [editNpcIcon, setEditNpcIcon] = useState('');
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('');
  const [editCorrectEmoji, setEditCorrectEmoji] = useState('');
  const [editIncorrectAnswer1, setEditIncorrectAnswer1] = useState('');
  const [editIncorrectEmoji1, setEditIncorrectEmoji1] = useState('');
  const [editIncorrectAnswer2, setEditIncorrectAnswer2] = useState('');
  const [editIncorrectEmoji2, setEditIncorrectEmoji2] = useState('');
  const [editIncorrectAnswer3, setEditIncorrectAnswer3] = useState('');
  const [editIncorrectEmoji3, setEditIncorrectEmoji3] = useState('');

  // Shuffled options by question ID
  const [shuffledById, setShuffledById] = useState<Record<string, Option[]>>({});

  // Export dialogues modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState('');

  // Vocabulary view toggle
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [newVocabWord, setNewVocabWord] = useState('');
  const [newVocabType, setNewVocabType] = useState('');
  const [newVocabDefinition, setNewVocabDefinition] = useState('');
  
  // Support messages
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);
  const [newVocabExample1, setNewVocabExample1] = useState('');
  const [newVocabExample2, setNewVocabExample2] = useState('');
  const [newVocabEquivalent, setNewVocabEquivalent] = useState('');
  const [editingVocabIndex, setEditingVocabIndex] = useState<number | null>(null);
  const [editingVocabFields, setEditingVocabFields] = useState({ word: '', type: '', definition: '', example1: '', example2: '', equivalent: '' });

  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * getFontSizeMultiplier());

  const fetchStories = async () => {
    const qs = await getDocs(collection(db, 'flowStories'));
    const data = qs.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FlowStory[];
    setStories(data);
    if (!selectedStory && data.length > 0) setSelectedStory(data[0]);
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

  useEffect(() => {
    fetchStories();
    fetchPendingMessagesCount();
  }, []);

  useEffect(() => {
    if (selectedChapter) {
      // @ts-ignore allow optional field
      setChapterBackground((selectedChapter as any).background || '');
      setEditChapterTitle(selectedChapter.title || '');
      setEditChapterActive(Boolean(selectedChapter.active ?? true));
      setEditChapterOrder(String(selectedChapter.order ?? ''));
      const map: Record<string, EditedQuestionView> = {};
      (selectedChapter.questions || []).forEach((q) => {
        map[q.id] = {
          id: q.id,
          npcName: q.npcName || '',
          npcSentence: q.npcSentence || '',
          npcIcon: q.npcIcon || '',
          a: q.correctAnswer || '',
          b: q.incorrectAnswer1 || '',
          c: q.incorrectAnswer2 || '',
          d: q.incorrectAnswer3 || '',
          aEmoji: q.correctEmoji || '',
          bEmoji: q.incorrectEmoji1 || '',
          cEmoji: q.incorrectEmoji2 || '',
          dEmoji: q.incorrectEmoji3 || '',
          correctKey: 'A',
        };
      });
      setEditedQuestions(map);
    } else {
      setChapterBackground('');
      setEditChapterTitle('');
      setEditChapterActive(true);
      setEditChapterOrder('');
      setEditedQuestions({});
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (selectedStory) {
      setStoryTitleEdit(selectedStory.title || '');
      setStoryDescriptionEdit(selectedStory.description || '');
      setStoryLevelEdit(selectedStory.level || '');
      setStoryImageUrlEdit(selectedStory.imageUrl || '');
      setStoryEmojiEdit(selectedStory.emoji || '');
      setStoryActiveEdit(Boolean(selectedStory.active ?? true));
    } else {
      setStoryTitleEdit('');
      setStoryDescriptionEdit('');
      setStoryLevelEdit('');
      setStoryImageUrlEdit('');
      setStoryEmojiEdit('');
      setStoryActiveEdit(true);
    }
  }, [selectedStory]);

  const saveStoryDetails = async () => {
    if (!selectedStory) return;
    const updatedStory: FlowStory = {
      ...selectedStory,
      title: storyTitleEdit.trim(),
      description: storyDescriptionEdit.trim(),
      level: storyLevelEdit.trim(),
      imageUrl: storyImageUrlEdit.trim(),
      emoji: storyEmojiEdit.trim(),
      active: storyActiveEdit,
    };
    await updateDoc(doc(db, 'flowStories', selectedStory.id), {
      title: updatedStory.title,
      description: updatedStory.description,
      level: updatedStory.level,
      imageUrl: updatedStory.imageUrl,
      emoji: updatedStory.emoji,
      active: updatedStory.active,
    });
    setSelectedStory(updatedStory);
    setStories(prev => prev.map(s => (s.id === updatedStory.id ? updatedStory : s)));
    Alert.alert('Saved', 'Story updated');
  };

  const saveChapterDetails = async () => {
    if (!selectedStory || !selectedChapter) return;
    const newOrderNumber = Number(editChapterOrder);
    const updatedChapter: FlowChapter = {
      ...selectedChapter,
      title: editChapterTitle.trim(),
      active: editChapterActive,
      order: Number.isFinite(newOrderNumber) ? newOrderNumber : selectedChapter.order,
      background: chapterBackground,
    };
    const updatedChapters = selectedStory.chapters.map(ch => (ch.id === selectedChapter.id ? updatedChapter : ch));
    await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
    const updatedStory = { ...selectedStory, chapters: updatedChapters };
    setSelectedStory(updatedStory);
    setSelectedChapter(updatedChapters.find(c => c.id === selectedChapter.id) || null);
    setStories(prev => prev.map(s => (s.id === updatedStory.id ? updatedStory : s)));
    Alert.alert('Saved', 'Chapter updated');
  };

  const handleCreateStory = async () => {
    try {
      await addDoc(collection(db, 'flowStories'), {
        title: title.trim(),
        description: description.trim(),
        level,
        emoji,
        imageUrl,
        active: true,
        createdAt: new Date(),
        chapters: [],
      });
      setTitle(''); setDescription(''); setLevel('Easy'); setImageUrl(''); setEmoji('📘');
      await fetchStories();
      Alert.alert('Created', 'Flow story created');
    } catch (e) {
      console.error(e); Alert.alert('Error', 'Failed to create');
    }
  };

  const handleAddChapter = async () => {
    if (!selectedStory || !newChapterTitle.trim()) return;
    const newChapter: FlowChapter = { id: Date.now().toString(), title: newChapterTitle.trim(), active: true, order: (selectedStory.chapters?.length || 0) + 1, questions: [], vocabulary: [], background: '' };
    const updated = { ...selectedStory, chapters: [...(selectedStory.chapters || []), newChapter] };
    await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updated.chapters });
    setSelectedStory(updated);
    setSelectedChapter(newChapter);
    setNewChapterTitle('');
    await fetchStories();
  };

  const handleToggleStoryActive = async (story: FlowStory) => {
    await updateDoc(doc(db, 'flowStories', story.id), { active: !story.active });
    await fetchStories();
    Alert.alert('Updated', `Story ${!story.active ? 'activated' : 'deactivated'}`);
  };

  // Clear selection and show the Create Story form
  const beginCreateNewStory = () => {
    setSelectedStory(null);
    setSelectedChapter(null);
    setTitle('');
    setDescription('');
    setLevel('Easy');
    setImageUrl('');
    setEmoji('📘');
  };

  const handleToggleChapterActive = async (chapter: FlowChapter) => {
    if (!selectedStory) return;
    const updatedChapters = selectedStory.chapters.map(ch => ch.id === chapter.id ? { ...ch, active: !ch.active } : ch);
    await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
    setSelectedStory({ ...selectedStory, chapters: updatedChapters });
    const updatedChapter = updatedChapters.find(c => c.id === chapter.id) || null;
    setSelectedChapter(updatedChapter);
    await fetchStories();
  };

  // Reorder chapters by moving one up or down and reindexing order sequentially
  const handleMoveChapter = async (chapterId: string, direction: 'up' | 'down') => {
    if (!selectedStory) return;
    try {
      const chaptersSorted = [...(selectedStory.chapters || [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const currentIndex = chaptersSorted.findIndex(c => c.id === chapterId);
      if (currentIndex < 0) return;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= chaptersSorted.length) return; // out of bounds

      // Swap positions in the array
      [chaptersSorted[currentIndex], chaptersSorted[targetIndex]] = [chaptersSorted[targetIndex], chaptersSorted[currentIndex]];

      // Reindex orders sequentially starting from 1
      const reindexed = chaptersSorted.map((c, i) => ({ ...c, order: i + 1 }));

      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: reindexed });

      const updatedStory = { ...selectedStory, chapters: reindexed };
      setSelectedStory(updatedStory);
      if (selectedChapter) {
        setSelectedChapter(updatedStory.chapters.find(c => c.id === selectedChapter.id) || null);
      }
    } catch (e) {
      console.error('Reorder chapter failed', e);
      Alert.alert('Error', 'Failed to reorder chapters');
    }
  };

  const handleBulkUploadDialogues = async () => {
    const story = selectedStory; const chapter = selectedChapter;
    if (!story || !chapter) { Alert.alert('Select story/chapter'); return; }
    if (!bulkDialogues.trim()) { Alert.alert('Enter dialogue text'); return; }
    try {
      const blocks = bulkDialogues.trim().split('/').filter(b => b.trim());
      const questions: FlowQuestion[] = [];
      for (const block of blocks) {
        const clean = block.replace(/^---|---$/g, '').trim();
        const parts = clean.split('---').filter(p => p.trim());
        // New format: ---npc sentence---correct answer---incorrect answer---incorrect answer2---incorrect answer3---
        if (parts.length < 5) continue;
        const [npcSentence, correct, inc1, inc2, inc3] = parts;
        const parseAns = (t: string) => ({ a: t.trim(), e: '' });
        const c = parseAns(correct); const i1 = parseAns(inc1); const i2 = parseAns(inc2); const i3 = parseAns(inc3);
        questions.push({ id: Date.now().toString() + Math.random(), npcName: '', npcSentence: (npcSentence||'').trim(), npcIcon: '', correctAnswer: c.a, correctEmoji: c.e, incorrectAnswer1: i1.a, incorrectEmoji1: i1.e, incorrectAnswer2: i2.a, incorrectEmoji2: i2.e, incorrectAnswer3: i3.a, incorrectEmoji3: i3.e });
      }
      if (questions.length === 0) { Alert.alert('No valid blocks'); return; }
      const updatedChapters = story.chapters.map(ch => ch.id === chapter.id ? { ...ch, questions: [...(ch.questions||[]), ...questions] } : ch);
      await updateDoc(doc(db, 'flowStories', story.id), { chapters: updatedChapters });
      setBulkDialogues(''); setShowBulkUpload(false);
      await fetchStories();
      const refreshed = (await getDocs(collection(db, 'flowStories'))).docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FlowStory[];
      setSelectedStory(refreshed.find(s => s.id === story.id) || null);
      setSelectedChapter((refreshed.find(s => s.id === story.id)?.chapters || []).find(c => c.id === chapter.id) || null);
      Alert.alert('Success', `Added ${questions.length} questions`);
    } catch (e) {
      console.error(e); Alert.alert('Error', 'Failed to upload');
    }
  };

  const handleBulkAddVocab = async () => {
    const story = selectedStory; const chapter = selectedChapter;
    if (!story || !chapter) { Alert.alert('Select story/chapter'); return; }
    if (!bulkVocabText.trim()) { Alert.alert('Enter vocabulary text'); return; }
    try {
      const blocks = bulkVocabText.split('/').map(b => b.trim()).filter(Boolean);
      const vocabItems = blocks.map(b => {
        const parts = b.split('---').map(p => p.trim()).filter(Boolean);
        if (parts.length < 6) return null;
        return { word: parts[0], type: parts[1], definition: parts[2], example1: parts[3], example2: parts[4], equivalent: parts[5] };
      }).filter(Boolean) as any[];
      if (vocabItems.length === 0) { Alert.alert('No valid vocab'); return; }
      const updatedChapters = story.chapters.map(ch => ch.id === chapter.id ? { ...ch, vocabulary: [...(ch.vocabulary || []), ...vocabItems] } : ch);
      await updateDoc(doc(db, 'flowStories', story.id), { chapters: updatedChapters });
      setBulkVocabText(''); setShowBulkVocab(false);
      await fetchStories();
      Alert.alert('Success', `Added ${vocabItems.length} vocab items`);
    } catch (e) {
      console.error(e); Alert.alert('Error', 'Failed to add vocab');
    }
  };

  const handleBulkAddChapters = async () => {
    const story = selectedStory;
    if (!story) { Alert.alert('Select a story first'); return; }
    if (!bulkChaptersText.trim()) { Alert.alert('Enter chapters text'); return; }
    
    try {
      // Split by chapter headers
      const chapterBlocks = bulkChaptersText.split(/<Chapter \d+ - .*?>/).filter(block => block.trim());
      const chapterHeaders = bulkChaptersText.match(/<Chapter \d+ - .*?>/g) || [];
      
      if (chapterBlocks.length === 0) { Alert.alert('No valid chapters found'); return; }
      
      const newChapters: FlowChapter[] = [];
      let currentOrder = (story.chapters || []).length + 1;
      
      for (let i = 0; i < chapterBlocks.length; i++) {
        const block = chapterBlocks[i].trim();
        const header = chapterHeaders[i];
        
        if (!block || !header) continue;
        
        // Extract chapter title from header
        const titleMatch = header.match(/<Chapter \d+ - (.*?)>/);
        const chapterTitle = titleMatch ? titleMatch[1].trim() : `Chapter ${currentOrder}`;
        
        // Parse questions from the block
        const questionBlocks = block.split('/').filter(q => q.trim());
        const questions: FlowQuestion[] = [];
        
        for (const questionBlock of questionBlocks) {
          const clean = questionBlock.replace(/^---|---$/g, '').trim();
          const parts = clean.split('---').filter(p => p.trim());
          
          if (parts.length < 5) continue;
          
          const [npcSentence, correct, inc1, inc2, inc3] = parts;
          questions.push({
            id: Date.now().toString() + Math.random(),
            npcName: '',
            npcSentence: (npcSentence || '').trim(),
            npcIcon: '',
            correctAnswer: correct.trim(),
            correctEmoji: '',
            incorrectAnswer1: inc1.trim(),
            incorrectEmoji1: '',
            incorrectAnswer2: inc2.trim(),
            incorrectEmoji2: '',
            incorrectAnswer3: inc3.trim(),
            incorrectEmoji3: ''
          });
        }
        
        if (questions.length > 0) {
          newChapters.push({
            id: Date.now().toString() + Math.random(),
            title: chapterTitle,
            active: true,
            order: currentOrder,
            questions,
            vocabulary: [],
            background: ''
          });
          currentOrder++;
        }
      }
      
      if (newChapters.length === 0) { Alert.alert('No valid chapters found'); return; }
      
      // Add new chapters to the story
      const updatedChapters = [...(story.chapters || []), ...newChapters];
      await updateDoc(doc(db, 'flowStories', story.id), { chapters: updatedChapters });
      
      setBulkChaptersText('');
      setShowBulkChapters(false);
      await fetchStories();
      
      const refreshed = (await getDocs(collection(db, 'flowStories'))).docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FlowStory[];
      setSelectedStory(refreshed.find(s => s.id === story.id) || null);
      
      Alert.alert('Success', `Added ${newChapters.length} chapters with ${newChapters.reduce((total, ch) => total + ch.questions.length, 0)} questions`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add chapters');
    }
  };

  const handleSeedDemoStories = async () => {
    try {
      const makeQuestion = (chapterIndex: number, qIndex: number): FlowQuestion => {
        const id = `${Date.now()}_${chapterIndex}_${qIndex}_${Math.random()}`;
        const prompt = `Scene ${chapterIndex + 1}.${qIndex + 1}: What should we do?`;
        const correct = 'Proceed carefully.';
        const wrong1 = 'Force it now!';
        const wrong2 = 'Ignore it.';
        const wrong3 = qIndex % 3 === 0 ? '' : 'Throw it away.'; // sometimes fewer than 4 options
        return {
          id,
          npcName: '',
          npcSentence: prompt,
          npcIcon: '',
          correctAnswer: correct,
          correctEmoji: '',
          incorrectAnswer1: wrong1,
          incorrectEmoji1: '',
          incorrectAnswer2: wrong2,
          incorrectEmoji2: '',
          incorrectAnswer3: wrong3,
          incorrectEmoji3: '',
          backgroundInfo: `Chapter ${chapterIndex + 1} context`,
        };
      };

      const makeChapter = (storyIndex: number, chapterIndex: number): FlowChapter => {
        const qCount = 12; // 12 dialogues
        const questions: FlowQuestion[] = Array.from({ length: qCount }).map((_, i) => makeQuestion(chapterIndex, i));
        return {
          id: `${Date.now()}_${storyIndex}_${chapterIndex}`,
          title: `Chapter ${chapterIndex + 1}`,
          active: true,
          order: chapterIndex + 1,
          questions,
          vocabulary: [],
          background: `Background for chapter ${chapterIndex + 1}`,
        };
      };

      const storyTemplates = [
        { title: 'The Rusted Key', description: 'A mystery unfolds behind an old lock.', emoji: '🗝️', level: 'Easy' },
        { title: 'Echoes in the Corridor', description: 'Footsteps lead to secrets in dim halls.', emoji: '🏚️', level: 'Medium' },
        { title: 'Ledger of Shadows', description: 'A ledger reveals hidden alliances.', emoji: '📜', level: 'Hard' },
      ];

      for (let s = 0; s < storyTemplates.length; s++) {
        const tmpl = storyTemplates[s];
        const chapterCount = 10; // 10 chapters
        const chapters: FlowChapter[] = Array.from({ length: chapterCount }).map((_, c) => makeChapter(s, c));
        await addDoc(collection(db, 'flowStories'), {
          title: tmpl.title,
          description: tmpl.description,
          level: tmpl.level,
          emoji: tmpl.emoji,
          imageUrl: '',
          active: true,
          createdAt: new Date(),
          chapters,
        });
      }

      await fetchStories();
      Alert.alert('Seeded', 'Created 3 demo stories with 10 chapters and 12 dialogues each.');
    } catch (e) {
      console.error('Seed failed', e);
      Alert.alert('Error', 'Failed to seed demo content');
    }
  };

  const beginEditQuestion = (q: FlowQuestion) => {
    setEditingQuestion(q);
    setEditNpcName(q.npcName); setEditNpcSentence(q.npcSentence); setEditNpcIcon(q.npcIcon);
    setEditCorrectAnswer(q.correctAnswer); setEditCorrectEmoji(q.correctEmoji);
    setEditIncorrectAnswer1(q.incorrectAnswer1); setEditIncorrectEmoji1(q.incorrectEmoji1);
    setEditIncorrectAnswer2(q.incorrectAnswer2); setEditIncorrectEmoji2(q.incorrectEmoji2);
    setEditIncorrectAnswer3(q.incorrectAnswer3); setEditIncorrectEmoji3(q.incorrectEmoji3);
  };

  const saveEditQuestion = async () => {
    console.log('Save question button pressed');
    if (!selectedStory || !selectedChapter || !editingQuestion) {
      console.log('Missing required data for saving question');
      return;
    }
    
    try {
      // Filter out empty incorrect answers
      const updatedQuestion: FlowQuestion = { 
        id: editingQuestion.id, 
        npcName: editNpcName, 
        npcSentence: editNpcSentence, 
        npcIcon: editNpcIcon, 
        correctAnswer: editCorrectAnswer, 
        correctEmoji: '', // Keep empty since we're not using emojis
        incorrectAnswer1: editIncorrectAnswer1.trim() || '', 
        incorrectEmoji1: '', // Keep empty since we're not using emojis
        incorrectAnswer2: editIncorrectAnswer2.trim() || '', 
        incorrectEmoji2: '', // Keep empty since we're not using emojis
        incorrectAnswer3: editIncorrectAnswer3.trim() || '', 
        incorrectEmoji3: '' // Keep empty since we're not using emojis
      };
      
      console.log('Updating question:', updatedQuestion);
      
      const updatedChapters = selectedStory.chapters.map(ch => {
        if (ch.id !== selectedChapter.id) return ch;
        const exists = (ch.questions || []).some(q => q.id === editingQuestion.id);
        const newQuestions = exists 
          ? ch.questions.map(q => (q.id === editingQuestion.id ? updatedQuestion : q))
          : [...(ch.questions || []), updatedQuestion];
        return { ...ch, questions: newQuestions };
      });
      
      // Update Firestore
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      console.log('Question saved to Firestore');
      
      // Update local state
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      setSelectedChapter(updatedChapter || null);
      // Invalidate cached shuffled options for this question so UI reflects latest answers
      setShuffledById(prev => { const copy = { ...prev }; delete copy[updatedQuestion.id]; return copy; });
      setEditingQuestion(null);
      
      Alert.alert('Success', 'Question updated successfully');
    } catch (error) {
      console.error('Error saving question:', error);
      Alert.alert('Error', 'Failed to save question');
    }
  };

  // Start creating a new question at the end of the list
  const beginCreateQuestion = () => {
    if (!selectedChapter) return;
    const newId = `${Date.now()}_${Math.random()}`;
    const draft: FlowQuestion = {
      id: newId,
      npcName: '',
      npcSentence: '',
      npcIcon: '',
      correctAnswer: '',
      correctEmoji: '',
      incorrectAnswer1: '',
      incorrectEmoji1: '',
      incorrectAnswer2: '',
      incorrectEmoji2: '',
      incorrectAnswer3: '',
      incorrectEmoji3: ''
    } as FlowQuestion;
    setEditingQuestion(draft);
    setEditNpcName('');
    setEditNpcSentence('');
    setEditNpcIcon('');
    setEditCorrectAnswer('');
    setEditCorrectEmoji('');
    setEditIncorrectAnswer1('');
    setEditIncorrectEmoji1('');
    setEditIncorrectAnswer2('');
    setEditIncorrectEmoji2('');
    setEditIncorrectAnswer3('');
    setEditIncorrectEmoji3('');
  };

  const handleDeleteIncorrectOption = async (optionNumber: 1 | 2 | 3) => {
    if (!selectedStory || !selectedChapter || !editingQuestion) return;
    
    // Create updated question with the specific option removed
    const updatedQuestion = { ...editingQuestion };
    
    switch (optionNumber) {
      case 1:
        updatedQuestion.incorrectAnswer1 = '';
        updatedQuestion.incorrectEmoji1 = '';
        setEditIncorrectAnswer1('');
        setEditIncorrectEmoji1('');
        break;
      case 2:
        updatedQuestion.incorrectAnswer2 = '';
        updatedQuestion.incorrectEmoji2 = '';
        setEditIncorrectAnswer2('');
        setEditIncorrectEmoji2('');
        break;
      case 3:
        updatedQuestion.incorrectAnswer3 = '';
        updatedQuestion.incorrectEmoji3 = '';
        setEditIncorrectAnswer3('');
        setEditIncorrectEmoji3('');
        break;
    }
    
    // Immediately update the question in Firestore
    const updatedChapters = selectedStory.chapters.map(ch => 
      ch.id === selectedChapter.id 
        ? { ...ch, questions: ch.questions.map(q => q.id === editingQuestion.id ? updatedQuestion : q) }
        : ch
    );
    
    try {
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      
      // Update local state
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      setSelectedChapter(updatedChapter || null);
      setEditingQuestion(updatedQuestion);
      // Clear cached shuffled options for this question so changes show immediately
      setShuffledById(prev => { const copy = { ...prev }; delete copy[updatedQuestion.id]; return copy; });
      
      Alert.alert('Deleted', `Incorrect option ${optionNumber} has been removed`);
    } catch (error) {
      console.error('Error deleting option:', error);
      Alert.alert('Error', 'Failed to delete option');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedStory || !selectedChapter) return;
    try {
      const updatedChapters = selectedStory.chapters.map(ch => ch.id === selectedChapter.id ? { ...ch, questions: (ch.questions || []).filter(q => q.id !== questionId) } : ch);
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const freshChapter = updatedChapters.find(c => c.id === selectedChapter.id)!;
      setSelectedChapter(freshChapter);
      if (editingQuestion && editingQuestion.id === questionId) setEditingQuestion(null);
      Alert.alert('Deleted', 'Question removed');
    } catch (e) {
      console.error('Delete question failed', e);
      Alert.alert('Error', 'Failed to delete question');
    }
  };

  // Move a question up or down within the current chapter
  const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    if (!selectedStory || !selectedChapter) return;
    try {
      const chaptersCopy = [...selectedStory.chapters];
      const chapterIndex = chaptersCopy.findIndex(ch => ch.id === selectedChapter.id);
      if (chapterIndex < 0) return;

      const questions = [...(chaptersCopy[chapterIndex].questions || [])];
      const currentIndex = questions.findIndex(q => q.id === questionId);
      if (currentIndex < 0) return;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= questions.length) return;

      // Swap the two questions
      [questions[currentIndex], questions[targetIndex]] = [questions[targetIndex], questions[currentIndex]];

      const updatedChapter = { ...chaptersCopy[chapterIndex], questions };
      const updatedChapters = chaptersCopy.map((ch, idx) => (idx === chapterIndex ? updatedChapter : ch));

      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });

      const updatedStory = { ...selectedStory, chapters: updatedChapters };
      setSelectedStory(updatedStory);
      setSelectedChapter(updatedChapter);
      if (editingQuestion) {
        const eq = questions.find(q => q.id === editingQuestion.id) || null;
        setEditingQuestion(eq);
      }
    } catch (e) {
      console.error('Reorder question failed', e);
      Alert.alert('Error', 'Failed to reorder question');
    }
  };

  const handleDeleteStory = async (story: FlowStory) => {
    console.log('Delete story button pressed for:', story.title);
    if (!story) return;
    
    try {
      console.log('Deleting story:', story.id);
      await deleteDoc(doc(db, 'flowStories', story.id));
      console.log('Story deleted from Firestore');
      
      // Update local state
      setStories(prev => prev.filter(s => s.id !== story.id));
      if (selectedStory?.id === story.id) {
        setSelectedStory(null);
        setSelectedChapter(null);
      }
      
      Alert.alert('Success', 'Story deleted successfully');
    } catch (error) {
      console.error('Error deleting story:', error);
      Alert.alert('Error', 'Failed to delete story');
    }
  };

  const handleDeleteChapter = async () => {
    console.log('Delete chapter button pressed');
    if (!selectedStory || !selectedChapter) {
      console.log('No selected story or chapter');
      return;
    }
    
    try {
      console.log('Deleting chapter:', selectedChapter.id);
      const updatedChapters = selectedStory.chapters.filter(ch => ch.id !== selectedChapter.id);
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      
      // Update local state
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      setSelectedChapter(null);
      
      Alert.alert('Success', 'Chapter deleted successfully');
    } catch (error) {
      console.error('Error deleting chapter:', error);
      Alert.alert('Error', 'Failed to delete chapter');
    }
  };

  // Vocabulary management functions
  const handleAddVocab = async () => {
    if (!selectedStory || !selectedChapter || !newVocabWord.trim()) return;
    
    try {
      const newVocabItem = {
        word: newVocabWord.trim(),
        type: newVocabType.trim(),
        definition: newVocabDefinition.trim(),
        example1: newVocabExample1.trim(),
        example2: newVocabExample2.trim(),
        equivalent: newVocabEquivalent.trim(),
      };
      
      const updatedChapters = selectedStory.chapters.map(ch => 
        ch.id === selectedChapter.id 
          ? { ...ch, vocabulary: [...(ch.vocabulary || []), newVocabItem] }
          : ch
      );
      
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      
      // Update local state
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      setSelectedChapter(updatedChapter || null);
      
      // Clear form
      setNewVocabWord('');
      setNewVocabType('');
      setNewVocabDefinition('');
      setNewVocabExample1('');
      setNewVocabExample2('');
      setNewVocabEquivalent('');
      
      Alert.alert('Success', 'Vocabulary word added');
    } catch (error) {
      console.error('Error adding vocabulary:', error);
      Alert.alert('Error', 'Failed to add vocabulary');
    }
  };

  const handleDeleteVocab = async (index: number) => {
    if (!selectedStory || !selectedChapter) return;
    
    try {
      const updatedChapters = selectedStory.chapters.map(ch => 
        ch.id === selectedChapter.id 
          ? { ...ch, vocabulary: (ch.vocabulary || []).filter((_, i) => i !== index) }
          : ch
      );
      
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      
      // Update local state
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      setSelectedChapter(updatedChapter || null);
      
      Alert.alert('Success', 'Vocabulary word deleted');
    } catch (error) {
      console.error('Error deleting vocabulary:', error);
      Alert.alert('Error', 'Failed to delete vocabulary');
    }
  };

  const handleStartEditVocab = (index: number, vocabItem: any) => {
    setEditingVocabIndex(index);
    setEditingVocabFields({
      word: vocabItem.word || '',
      type: vocabItem.type || '',
      definition: vocabItem.definition || '',
      example1: vocabItem.example1 || '',
      example2: vocabItem.example2 || '',
      equivalent: vocabItem.equivalent || '',
    });
  };

  const handleSaveEditVocab = async () => {
    if (!selectedStory || !selectedChapter || editingVocabIndex === null) return;
    
    try {
      const updatedChapters = selectedStory.chapters.map(ch => 
        ch.id === selectedChapter.id 
          ? { 
              ...ch, 
              vocabulary: (ch.vocabulary || []).map((v, i) => 
                i === editingVocabIndex ? editingVocabFields : v
              )
            }
          : ch
      );
      
      await updateDoc(doc(db, 'flowStories', selectedStory.id), { chapters: updatedChapters });
      
      // Update local state
      setSelectedStory({ ...selectedStory, chapters: updatedChapters });
      const updatedChapter = updatedChapters.find(c => c.id === selectedChapter.id);
      setSelectedChapter(updatedChapter || null);
      
      // Clear editing state
      setEditingVocabIndex(null);
      setEditingVocabFields({ word: '', type: '', definition: '', example1: '', example2: '', equivalent: '' });
      
      Alert.alert('Success', 'Vocabulary word updated');
    } catch (error) {
      console.error('Error updating vocabulary:', error);
      Alert.alert('Error', 'Failed to update vocabulary');
    }
  };

  const buildOptions = (q: FlowQuestion): Option[] => [
    { text: q.correctAnswer, emoji: q.correctEmoji, correct: true },
    { text: q.incorrectAnswer1, emoji: q.incorrectEmoji1, correct: false },
    { text: q.incorrectAnswer2, emoji: q.incorrectEmoji2, correct: false },
    { text: q.incorrectAnswer3, emoji: q.incorrectEmoji3, correct: false },
  ].filter(o => (o.text || '').trim().length > 0);

  const getOptionsForQuestion = (q: FlowQuestion): Option[] => {
    if (shuffledById[q.id]) return shuffledById[q.id];
    const base = buildOptions(q);
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    setShuffledById(prev => ({ ...prev, [q.id]: shuffled }));
    return shuffled;
  };

  const getScaled = getScaledFontSize;

  // Build export text: all chapters with chapter-name separator and per-question options (✓ marks correct)
  const buildExportText = (story: FlowStory) => {
    const chapters = [...(story.chapters || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const lines: string[] = [];
    chapters.forEach((ch) => {
      lines.push(`=== ${ch.title} ===`);
      (ch.questions || []).forEach((q, qi) => {
        const opts: { label: string; text: string; correct: boolean }[] = [];
        const pushIf = (label: string, text: string, correct: boolean) => {
          const t = (text || '').trim();
          if (t.length > 0) opts.push({ label, text: t, correct });
        };
        pushIf('A', q.correctAnswer, true);
        pushIf('B', q.incorrectAnswer1, false);
        pushIf('C', q.incorrectAnswer2, false);
        pushIf('D', q.incorrectAnswer3, false);
        lines.push(`${qi + 1}. ${q.npcSentence}`);
        opts.forEach(o => lines.push(`   ${o.label}) ${o.text} ${o.correct ? '[✓]' : ''}`));
        lines.push('');
      });
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleExportDialogues = () => {
    if (!selectedStory) { Alert.alert('Select a story first'); return; }
    const text = buildExportText(selectedStory);
    setExportText(text);
    setShowExportModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.headerContainer}>
        <Text style={{ color: theme.primaryText, fontSize: getScaled(24), fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>Flow Admin Panel</Text>
        <TouchableOpacity 
          style={styles.messageButton}
          onPress={() => {
            navigation.navigate('Messages' as never);
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
        {/* Left Panel */}
        <ScrollView style={[styles.leftPanel, { backgroundColor: theme.cardColor }]}>
          {/* Utilities */}
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={beginCreateNewStory}>
            <Text style={styles.buttonText}>New Story</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleSeedDemoStories}>
            <Text style={styles.buttonText}>Seed 3 Demo Stories</Text>
          </TouchableOpacity>
          {selectedStory && (
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleExportDialogues}>
              <Text style={styles.buttonText}>Export Dialogues (All Chapters)</Text>
            </TouchableOpacity>
          )}
          {/* Edit or Create Story */}
          {selectedStory ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Edit Story: {selectedStory.title}</Text>
              <Text style={[styles.label, { color: theme.primaryText }]}>Title</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={storyTitleEdit} onChangeText={setStoryTitleEdit} placeholder="Title" placeholderTextColor={theme.secondaryText} />
              <Text style={[styles.label, { color: theme.primaryText }]}>Description</Text>
              <TextInput style={[styles.textArea, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={storyDescriptionEdit} onChangeText={setStoryDescriptionEdit} placeholder="Description" placeholderTextColor={theme.secondaryText} multiline numberOfLines={3} />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.primaryText }]}>Level</Text>
                  <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={storyLevelEdit} onChangeText={setStoryLevelEdit} placeholder="Easy | Medium | Hard" placeholderTextColor={theme.secondaryText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.primaryText }]}>Emoji</Text>
                  <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={storyEmojiEdit} onChangeText={setStoryEmojiEdit} placeholder="📘" placeholderTextColor={theme.secondaryText} />
      </View>
      </View>
              <Text style={[styles.label, { color: theme.primaryText }]}>Image URL</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={storyImageUrlEdit} onChangeText={setStoryImageUrlEdit} placeholder="https://..." placeholderTextColor={theme.secondaryText} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: theme.primaryText, fontWeight: '600' }}>Active</Text>
                <Switch value={storyActiveEdit} onValueChange={(v)=>{ setStoryActiveEdit(v); }} trackColor={{ false: theme.borderColor, true: theme.primary }} />
          </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={saveStoryDetails}><Text style={styles.buttonText}>Save Story</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, { backgroundColor: storyActiveEdit ? theme.warning : theme.success }]} onPress={() => selectedStory && handleToggleStoryActive(selectedStory)}>
                  <Text style={styles.buttonText}>{selectedStory?.active ? 'Deactivate' : 'Activate'}</Text>
            </TouchableOpacity>
            </View>

              <View style={styles.divider} />

              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Add Chapter</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={newChapterTitle} onChangeText={setNewChapterTitle} placeholder="New chapter title" placeholderTextColor={theme.secondaryText} />
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.success }]} onPress={handleAddChapter}><Text style={styles.buttonText}>Add Chapter</Text></TouchableOpacity>

              <View style={styles.divider} />

              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Add Bulk Chapters</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => setShowBulkChapters(!showBulkChapters)}>
                <Text style={styles.buttonText}>{showBulkChapters ? 'Hide' : 'Show'} Bulk Chapters</Text>
              </TouchableOpacity>
              {showBulkChapters && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: theme.secondaryText, marginBottom: 6 }}>
                    Format:{'\n'}
                    {'<Chapter 1 - Chapter Name>'}
                    {'\n---npc sentence---correct answer---incorrect answer---incorrect answer2---incorrect answer3--- /'}
                    {'\n---npc sentence---correct answer---incorrect answer---incorrect answer2---incorrect answer3--- /'}
                    {'\n\n<Chapter 2 - Chapter Name>'}
                    {'\n---npc sentence---correct answer---incorrect answer---incorrect answer2---incorrect answer3--- /'}
                  </Text>
                  <TextInput 
                    style={[styles.textArea, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor, height: 200 }]} 
                    value={bulkChaptersText} 
                    onChangeText={setBulkChaptersText} 
                    placeholder="Paste chapters..." 
                    placeholderTextColor={theme.secondaryText} 
                    multiline 
                    numberOfLines={10} 
                  />
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: selectedStory ? theme.success : theme.secondaryText }]} 
                    disabled={!selectedStory} 
                    onPress={handleBulkAddChapters}
                  >
                    <Text style={styles.buttonText}>Add Chapters</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.divider} />

              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Bulk Upload Dialogues</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => setShowBulkUpload(!showBulkUpload)}>
                <Text style={styles.buttonText}>{showBulkUpload ? 'Hide' : 'Show'} Bulk Upload</Text>
          </TouchableOpacity>
          {showBulkUpload && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: theme.secondaryText, marginBottom: 6 }}>Format: ---npc sentence---correct answer---incorrect answer---incorrect answer2---incorrect answer3--- /</Text>
                  <TextInput style={[styles.textArea, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor, height: 160 }]} value={bulkDialogues} onChangeText={setBulkDialogues} placeholder="Paste dialogues..." placeholderTextColor={theme.secondaryText} multiline numberOfLines={8} />
                  <TouchableOpacity style={[styles.button, { backgroundColor: selectedChapter ? theme.success : theme.secondaryText }]} disabled={!selectedChapter} onPress={handleBulkUploadDialogues}><Text style={styles.buttonText}>Upload Dialogues</Text></TouchableOpacity>
        </View>
      )}

              <View style={styles.divider} />

              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Bulk Add Vocabulary</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => setShowBulkVocab(!showBulkVocab)}>
                <Text style={styles.buttonText}>{showBulkVocab ? 'Hide' : 'Show'} Bulk Vocabulary</Text>
          </TouchableOpacity>
          {showBulkVocab && (
            <View style={{ marginTop: 12 }}>
                  <Text style={{ color: theme.secondaryText, marginBottom: 6 }}>Format: word---type---definition---example1---example2---equivalent /</Text>
                  <TextInput style={[styles.textArea, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor, height: 160 }]} value={bulkVocabText} onChangeText={setBulkVocabText} placeholder="Paste vocabulary..." placeholderTextColor={theme.secondaryText} multiline numberOfLines={8} />
                  <TouchableOpacity style={[styles.button, { backgroundColor: selectedChapter ? theme.success : theme.secondaryText }]} disabled={!selectedChapter} onPress={handleBulkAddVocab}><Text style={styles.buttonText}>Add Vocabulary</Text></TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Create Story</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={theme.secondaryText} />
              <TextInput style={[styles.textArea, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={theme.secondaryText} multiline numberOfLines={3} />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={level} onChangeText={setLevel} placeholder="Easy | Medium | Hard" placeholderTextColor={theme.secondaryText} />
                <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={emoji} onChangeText={setEmoji} placeholder="📘" placeholderTextColor={theme.secondaryText} />
            </View>
              <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." placeholderTextColor={theme.secondaryText} />
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleCreateStory}><Text style={styles.buttonText}>Create Story</Text></TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Right Panel */}
        <ScrollView style={[styles.rightPanel, { backgroundColor: theme.cardColor }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Stories ({stories.length})</Text>
          <View style={{ marginBottom: 16 }}>
            {stories.map((s) => (
              <TouchableOpacity key={s.id} style={[styles.storyItem, { borderColor: theme.borderColor, backgroundColor: selectedStory?.id === s.id ? theme.primary : theme.surfaceColor }]} onPress={() => { setSelectedStory(s); setSelectedChapter(null); }}>
                <View style={styles.storyHeader}>
                  {(s.imageUrl || (s.emoji && s.emoji.startsWith('http'))) ? (
                    <Image source={{ uri: s.imageUrl || s.emoji }} style={styles.storyImage} />
                                      ) : (
                      <Text style={[styles.storyEmoji]}>{s.emoji}</Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.storyTitle, { color: selectedStory?.id === s.id ? '#fff' : theme.primaryText }]}>{s.title}</Text>
                      <Text style={[styles.storyLevel, { color: selectedStory?.id === s.id ? '#fff' : theme.secondaryText }]}>{s.level}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.primary }]} onPress={(e) => { e.stopPropagation(); setSelectedStory(s); }}><Text style={styles.smallBtnText}>Edit</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: s.active ? theme.success : theme.warning }]} onPress={(e) => { e.stopPropagation(); handleToggleStoryActive(s); }}>
                        <Text style={styles.smallBtnText}>{s.active ? 'Active' : 'Inactive'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.smallBtn, { backgroundColor: theme.error, minWidth: 60 }]} 
                        onPress={(e) => { 
                          e.stopPropagation(); 
                          console.log('Delete story button clicked for:', s.title);
                          handleDeleteStory(s); 
                        }}
                      >
                        <Text style={styles.smallBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
            ))}
          </View>

          {/* Selected Story Details */}
          {selectedStory && (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>{selectedStory.title} Details</Text>
              <Text style={{ color: theme.secondaryText, marginBottom: 8 }}>Chapters: {selectedStory.chapters.length}</Text>

              {/* View Toggle - Between chapters and content */}
              {selectedChapter && (
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: !showVocabulary ? theme.primary : theme.secondaryText, flex: 1 }]} 
                    onPress={() => setShowVocabulary(false)}
                  >
                    <Text style={styles.buttonText}>Questions</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: showVocabulary ? theme.primary : theme.secondaryText, flex: 1 }]} 
                    onPress={() => setShowVocabulary(true)}
                  >
                    <Text style={styles.buttonText}>Vocabulary</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Chapters List */}
              <View>
                {[...selectedStory.chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((ch, index, arr) => (
                  <TouchableOpacity key={ch.id} style={[styles.chapterItem, { borderColor: theme.borderColor, backgroundColor: selectedChapter?.id === ch.id ? theme.primary : theme.surfaceColor }]} onPress={() => setSelectedChapter(ch)}>
                    <View style={styles.chapterHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.chapterTitle, { color: selectedChapter?.id === ch.id ? '#fff' : theme.primaryText }]}>
                          {`${ch.order ?? (index + 1)}. ${ch.title}`}
                        </Text>
                        <Text style={{ color: selectedChapter?.id === ch.id ? '#fff' : theme.secondaryText }}>{(ch.questions || []).length} questions</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {/* Reorder controls */}
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: theme.primary, opacity: index === 0 ? 0.5 : 1 }]}
                          disabled={index === 0}
                          onPress={() => handleMoveChapter(ch.id, 'up')}
                        >
                          <Text style={styles.smallBtnText}>↑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: theme.primary, opacity: index === arr.length - 1 ? 0.5 : 1 }]}
                          disabled={index === arr.length - 1}
                          onPress={() => handleMoveChapter(ch.id, 'down')}
                        >
                          <Text style={styles.smallBtnText}>↓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: ch.active ? theme.success : theme.warning }]} onPress={(e) => { e.stopPropagation(); handleToggleChapterActive(ch); }}>
                          <Text style={styles.smallBtnText}>{ch.active ? 'Active' : 'Inactive'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.smallBtn, { backgroundColor: theme.error, minWidth: 60 }]} 
                          onPress={(e) => { 
                            e.stopPropagation(); 
                            console.log('Delete chapter button clicked for:', ch.title);
                            handleDeleteChapter(); 
                          }}
                        >
                          <Text style={styles.smallBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Chapter Editor and Questions */}
              {selectedChapter && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Edit Chapter</Text>
                  <TextInput style={[styles.input, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editChapterTitle} onChangeText={setEditChapterTitle} placeholder="Chapter title" placeholderTextColor={theme.secondaryText} />
                  <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editChapterOrder} onChangeText={setEditChapterOrder} placeholder="Order (number)" placeholderTextColor={theme.secondaryText} keyboardType="numeric" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingHorizontal: 8 }}>
                      <Text style={{ color: theme.primaryText, fontWeight: '600' }}>Active</Text>
                      <Switch value={editChapterActive} onValueChange={setEditChapterActive} trackColor={{ false: theme.borderColor, true: theme.primary }} />
                    </View>
                  </View>
                  <TextInput style={[styles.textArea, { backgroundColor: theme.surfaceColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={chapterBackground} onChangeText={setChapterBackground} placeholder="Chapter background" placeholderTextColor={theme.secondaryText} multiline numberOfLines={4} />
                  <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={saveChapterDetails}><Text style={styles.buttonText}>Save Chapter</Text></TouchableOpacity>

                  <View style={styles.divider} />

                  <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                    {showVocabulary ? 'Vocabulary' : 'Questions'} in {selectedChapter.title}
                  </Text>
                  
                  {showVocabulary ? (
                    // Vocabulary Section
                    <View>
                      <Text style={[styles.sectionTitle, { color: theme.primaryText, marginTop: 16 }]}>Vocabulary for {selectedChapter.title}</Text>
                      
                      {/* Add New Vocabulary Form */}
                      <View style={[styles.questionCard, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
                        <Text style={[styles.label, { color: theme.primaryText }]}>Add New Vocabulary</Text>
                        <TextInput 
                          style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                          value={newVocabWord} 
                          onChangeText={setNewVocabWord} 
                          placeholder="Word" 
                          placeholderTextColor={theme.secondaryText} 
                        />
                        <TextInput 
                          style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                          value={newVocabType} 
                          onChangeText={setNewVocabType} 
                          placeholder="Type (noun, verb, etc.)" 
                          placeholderTextColor={theme.secondaryText} 
                        />
                        <TextInput 
                          style={[styles.textArea, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                          value={newVocabDefinition} 
                          onChangeText={setNewVocabDefinition} 
                          placeholder="Definition" 
                          placeholderTextColor={theme.secondaryText} 
                          multiline 
                          numberOfLines={2} 
                        />
                        <TextInput 
                          style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                          value={newVocabExample1} 
                          onChangeText={setNewVocabExample1} 
                          placeholder="Example 1" 
                          placeholderTextColor={theme.secondaryText} 
                        />
                        <TextInput 
                          style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                          value={newVocabExample2} 
                          onChangeText={setNewVocabExample2} 
                          placeholder="Example 2" 
                          placeholderTextColor={theme.secondaryText} 
                        />
                        <TextInput 
                          style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                          value={newVocabEquivalent} 
                          onChangeText={setNewVocabEquivalent} 
                          placeholder="Equivalent in your language" 
                          placeholderTextColor={theme.secondaryText} 
                        />
                        <TouchableOpacity 
                          style={[styles.button, { backgroundColor: theme.success, marginTop: 12 }]} 
                          onPress={handleAddVocab}
                        >
                          <Text style={styles.buttonText}>Add Vocabulary</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Vocabulary List */}
                      {(selectedChapter.vocabulary || []).map((vocabItem, idx) => (
                        <View key={idx} style={[styles.questionCard, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
                          {editingVocabIndex === idx ? (
                            <View>
                              <Text style={[styles.label, { color: theme.primaryText }]}>Edit Vocabulary</Text>
                              <TextInput 
                                style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                                value={editingVocabFields.word} 
                                onChangeText={(text) => setEditingVocabFields(prev => ({ ...prev, word: text }))} 
                                placeholder="Word" 
                                placeholderTextColor={theme.secondaryText} 
                              />
                              <TextInput 
                                style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                                value={editingVocabFields.type} 
                                onChangeText={(text) => setEditingVocabFields(prev => ({ ...prev, type: text }))} 
                                placeholder="Type" 
                                placeholderTextColor={theme.secondaryText} 
                              />
                              <TextInput 
                                style={[styles.textArea, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                                value={editingVocabFields.definition} 
                                onChangeText={(text) => setEditingVocabFields(prev => ({ ...prev, definition: text }))} 
                                placeholder="Definition" 
                                placeholderTextColor={theme.secondaryText} 
                                multiline 
                                numberOfLines={2} 
                              />
                              <TextInput 
                                style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                                value={editingVocabFields.example1} 
                                onChangeText={(text) => setEditingVocabFields(prev => ({ ...prev, example1: text }))} 
                                placeholder="Example 1" 
                                placeholderTextColor={theme.secondaryText} 
                              />
                              <TextInput 
                                style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                                value={editingVocabFields.example2} 
                                onChangeText={(text) => setEditingVocabFields(prev => ({ ...prev, example2: text }))} 
                                placeholder="Example 2" 
                                placeholderTextColor={theme.secondaryText} 
                              />
                              <TextInput 
                                style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} 
                                value={editingVocabFields.equivalent} 
                                onChangeText={(text) => setEditingVocabFields(prev => ({ ...prev, equivalent: text }))} 
                                placeholder="Equivalent" 
                                placeholderTextColor={theme.secondaryText} 
                              />
                              <View style={styles.buttonRow}>
                                <TouchableOpacity 
                                  style={[styles.button, { backgroundColor: theme.success }]} 
                                  onPress={handleSaveEditVocab}
                                >
                                  <Text style={styles.buttonText}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  style={[styles.button, { backgroundColor: theme.error }]} 
                                  onPress={() => setEditingVocabIndex(null)}
                                >
                                  <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <View>
                              <View style={styles.questionHeader}>
                                <Text style={{ color: theme.primaryText, fontWeight: '600' }}>V{idx + 1}: {vocabItem.word}</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity 
                                    style={[styles.smallBtn, { backgroundColor: theme.primary }]} 
                                    onPress={() => handleStartEditVocab(idx, vocabItem)}
                                  >
                                    <Text style={styles.smallBtnText}>Edit</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[styles.smallBtn, { backgroundColor: theme.error }]} 
                                    onPress={() => handleDeleteVocab(idx)}
                                  >
                                    <Text style={styles.smallBtnText}>Delete</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              <View>
                                <Text style={{ color: theme.secondaryText, marginBottom: 4 }}>Type: {vocabItem.type}</Text>
                                <Text style={{ color: theme.secondaryText, marginBottom: 4 }}>Definition: {vocabItem.definition}</Text>
                                <Text style={{ color: theme.secondaryText, marginBottom: 4 }}>Example 1: {vocabItem.example1}</Text>
                                <Text style={{ color: theme.secondaryText, marginBottom: 4 }}>Example 2: {vocabItem.example2}</Text>
                                <Text style={{ color: theme.secondaryText, marginBottom: 4 }}>Equivalent: {vocabItem.equivalent}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    // Questions Section (existing code)
                    <View>
                  {((selectedChapter.questions || []).length === 0) && (
                    <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginBottom: 8 }]} onPress={beginCreateQuestion}>
                      <Text style={styles.buttonText}>Add Question</Text>
                    </TouchableOpacity>
                  )}
                  {/* Show draft editor when creating a new question and it is not yet in the list */}
                  {((selectedChapter.questions || []).length === 0) && editingQuestion && !(selectedChapter.questions || []).some(q => q.id === editingQuestion.id) && (
                    <View style={[styles.questionCard, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}> 
                      <Text style={[styles.label, { color: theme.primaryText }]}>NPC Sentence</Text>
                      <TextInput style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editNpcSentence} onChangeText={setEditNpcSentence} placeholder="NPC sentence" placeholderTextColor={theme.secondaryText} />

                      <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Correct Answer</Text>
                      <TextInput style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editCorrectAnswer} onChangeText={setEditCorrectAnswer} placeholder="Correct answer" placeholderTextColor={theme.secondaryText} />

                      {editIncorrectAnswer1.trim() && (
                        <>
                          <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 1</Text>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer1} onChangeText={setEditIncorrectAnswer1} placeholder="Incorrect 1" placeholderTextColor={theme.secondaryText} />
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(1)}>
                              <Text style={styles.smallBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      {editIncorrectAnswer2.trim() && (
                        <>
                          <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 2</Text>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer2} onChangeText={setEditIncorrectAnswer2} placeholder="Incorrect 2" placeholderTextColor={theme.secondaryText} />
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(2)}>
                              <Text style={styles.smallBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      {editIncorrectAnswer3.trim() && (
                        <>
                          <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 3</Text>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer3} onChangeText={setEditIncorrectAnswer3} placeholder="Incorrect 3" placeholderTextColor={theme.secondaryText} />
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(3)}>
                              <Text style={styles.smallBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      <TouchableOpacity 
                        style={[styles.button, { backgroundColor: theme.primary, marginTop: 12 }]} 
                        onPress={() => {
                          if (!editIncorrectAnswer1.trim()) {
                            setEditIncorrectAnswer1('New option');
                          } else if (!editIncorrectAnswer2.trim()) {
                            setEditIncorrectAnswer2('New option');
                          } else if (!editIncorrectAnswer3.trim()) {
                            setEditIncorrectAnswer3('New option');
                          }
                        }}
                      >
                        <Text style={styles.buttonText}>Add Incorrect Option</Text>
                      </TouchableOpacity>

                      <View style={styles.buttonRow}>
                        <TouchableOpacity 
                          style={[styles.button, { backgroundColor: theme.success }]} 
                          onPress={saveEditQuestion}
                        >
                          <Text style={styles.buttonText}>Save Question</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.error }]} onPress={() => setEditingQuestion(null)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {(selectedChapter.questions || []).map((q, idx) => {
                    const optionsList = getOptionsForQuestion(q);
                    return (
                      <View key={q.id} style={[styles.questionCard, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}> 
                        {editingQuestion?.id === q.id ? (
                          <View>
                            <Text style={[styles.label, { color: theme.primaryText }]}>NPC Sentence</Text>
                            <TextInput style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editNpcSentence} onChangeText={setEditNpcSentence} placeholder="NPC sentence" placeholderTextColor={theme.secondaryText} />

                            <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Correct Answer</Text>
                            <TextInput style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editCorrectAnswer} onChangeText={setEditCorrectAnswer} placeholder="Correct answer" placeholderTextColor={theme.secondaryText} />

                            {/* Only show incorrect options that have content */}
                            {editIncorrectAnswer1.trim() && (
                              <>
                                <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 1</Text>
                                <View style={styles.row}>
                                  <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer1} onChangeText={setEditIncorrectAnswer1} placeholder="Incorrect 1" placeholderTextColor={theme.secondaryText} />
                                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(1)}>
                                    <Text style={styles.smallBtnText}>Delete</Text>
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}

                            {editIncorrectAnswer2.trim() && (
                              <>
                                <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 2</Text>
                                <View style={styles.row}>
                                  <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer2} onChangeText={setEditIncorrectAnswer2} placeholder="Incorrect 2" placeholderTextColor={theme.secondaryText} />
                                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(2)}>
                                    <Text style={styles.smallBtnText}>Delete</Text>
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}

                            {editIncorrectAnswer3.trim() && (
                              <>
                                <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 3</Text>
                                <View style={styles.row}>
                                  <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer3} onChangeText={setEditIncorrectAnswer3} placeholder="Incorrect 3" placeholderTextColor={theme.secondaryText} />
                                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(3)}>
                                    <Text style={styles.smallBtnText}>Delete</Text>
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}

                            <View style={styles.buttonRow}>
                              <TouchableOpacity 
                                style={[styles.button, { backgroundColor: theme.success }]} 
                                onPress={() => {
                                  console.log('Save Question button clicked');
                                  saveEditQuestion();
                                }}
                              >
                                <Text style={styles.buttonText}>Save Question</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.button, { backgroundColor: theme.error }]} onPress={() => setEditingQuestion(null)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={styles.questionHeader}> 
                              <Text style={{ color: theme.primaryText, fontWeight: '600' }}>Q{idx + 1}: {q.npcSentence}</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                {/* Reorder question controls */}
                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.primary, opacity: idx === 0 ? 0.5 : 1 }]} disabled={idx === 0} onPress={() => handleMoveQuestion(q.id, 'up')}>
                                  <Text style={styles.smallBtnText}>↑</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.primary, opacity: idx === (selectedChapter.questions?.length || 1) - 1 ? 0.5 : 1 }]} disabled={idx === (selectedChapter.questions?.length || 1) - 1} onPress={() => handleMoveQuestion(q.id, 'down')}>
                                  <Text style={styles.smallBtnText}>↓</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.primary }]} onPress={() => beginEditQuestion(q)}><Text style={styles.smallBtnText}>Edit</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteQuestion(q.id)}><Text style={styles.smallBtnText}>Delete</Text></TouchableOpacity>
                              </View>
                            </View>
                            <View>
                              <Text style={{ color: theme.secondaryText, marginBottom: 4 }}>Options ({optionsList.length})</Text>
                              {optionsList.map((opt, oi) => (
                                <Text key={oi} style={{ color: opt.correct ? theme.success : theme.error }}>
                                  {opt.correct ? '✓' : '✗'} {opt.text}
                                </Text>
                              ))}
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })}
                  {/* If there are questions, show draft editor at the bottom when creating a new one */}
                  {((selectedChapter.questions || []).length > 0) && editingQuestion && !(selectedChapter.questions || []).some(q => q.id === editingQuestion.id) && (
                    <View style={[styles.questionCard, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}> 
                      <Text style={[styles.label, { color: theme.primaryText }]}>NPC Sentence</Text>
                      <TextInput style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editNpcSentence} onChangeText={setEditNpcSentence} placeholder="NPC sentence" placeholderTextColor={theme.secondaryText} />

                      <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Correct Answer</Text>
                      <TextInput style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor }]} value={editCorrectAnswer} onChangeText={setEditCorrectAnswer} placeholder="Correct answer" placeholderTextColor={theme.secondaryText} />

                      {editIncorrectAnswer1.trim() && (
                        <>
                          <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 1</Text>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer1} onChangeText={setEditIncorrectAnswer1} placeholder="Incorrect 1" placeholderTextColor={theme.secondaryText} />
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(1)}>
                              <Text style={styles.smallBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      {editIncorrectAnswer2.trim() && (
                        <>
                          <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 2</Text>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer2} onChangeText={setEditIncorrectAnswer2} placeholder="Incorrect 2" placeholderTextColor={theme.secondaryText} />
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(2)}>
                              <Text style={styles.smallBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      {editIncorrectAnswer3.trim() && (
                        <>
                          <Text style={[styles.label, { color: theme.primaryText, marginTop: 8 }]}>Incorrect 3</Text>
                          <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.backgroundColor, color: theme.primaryText, borderColor: theme.borderColor, marginRight: 8 }]} value={editIncorrectAnswer3} onChangeText={setEditIncorrectAnswer3} placeholder="Incorrect 3" placeholderTextColor={theme.secondaryText} />
                            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.error }]} onPress={() => handleDeleteIncorrectOption(3)}>
                              <Text style={styles.smallBtnText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}

                      <TouchableOpacity 
                        style={[styles.button, { backgroundColor: theme.primary, marginTop: 12 }]} 
                        onPress={() => {
                          if (!editIncorrectAnswer1.trim()) {
                            setEditIncorrectAnswer1('New option');
                          } else if (!editIncorrectAnswer2.trim()) {
                            setEditIncorrectAnswer2('New option');
                          } else if (!editIncorrectAnswer3.trim()) {
                            setEditIncorrectAnswer3('New option');
                          }
                        }}
                      >
                        <Text style={styles.buttonText}>Add Incorrect Option</Text>
                      </TouchableOpacity>

                      <View style={styles.buttonRow}>
                        <TouchableOpacity 
                          style={[styles.button, { backgroundColor: theme.success }]} 
                          onPress={saveEditQuestion}
                        >
                          <Text style={styles.buttonText}>Save Question</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.error }]} onPress={() => setEditingQuestion(null)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {((selectedChapter.questions || []).length > 0) && (
                    <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={beginCreateQuestion}>
                      <Text style={styles.buttonText}>Add Question</Text>
                    </TouchableOpacity>
                  )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
      
      {showExportModal && (
        <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: theme.cardColor, padding: 16, borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '85%' }}>
              <Text style={{ color: theme.primaryText, fontWeight: 'bold', fontSize: getScaled(18), marginBottom: 8 }}>Export Dialogues</Text>
              <Text style={{ color: theme.secondaryText, marginBottom: 8 }}>Chapter headers are included. Correct options are marked with [✓]. Long‑press to copy.</Text>
              <ScrollView style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 8, padding: 10, backgroundColor: theme.surfaceColor, maxHeight: 500 }}>
                <Text selectable style={{ color: theme.primaryText, fontSize: getScaled(14) }}>{exportText}</Text>
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => setShowExportModal(false)}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  content: { flex: 1, flexDirection: 'row', gap: 16 },
  leftPanel: { flex: 1, padding: 16, borderRadius: 12 },
  rightPanel: { flex: 2, padding: 16, borderRadius: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12, fontSize: 18 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  label: { marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#ccc', marginVertical: 16 },
  storyItem: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storyImage: { width: 40, height: 40, borderRadius: 8 },
  storyEmoji: { fontSize: 24, width: 40, textAlign: 'center' },
  storyTitle: { fontWeight: 'bold' },
  storyLevel: { marginTop: 2 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  chapterItem: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chapterTitle: { fontWeight: 'bold' },
  questionCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  questionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
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

export default FlowAdminPanel; 