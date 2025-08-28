import { useNavigation } from '@react-navigation/native';
import { addDoc, collection, deleteDoc, doc, DocumentData, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

const ADMIN_EMAIL = 'tahirenes.kahraman@gmail.com'; // Change to your admin email

const AdminPanelScreen = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [lessons, setLessons] = useState<DocumentData[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<DocumentData | null>(null);
  const [newDialogue, setNewDialogue] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [newVocab, setNewVocab] = useState('');
  const [editingVocabIndex, setEditingVocabIndex] = useState<number | null>(null);
  const [editingVocabValue, setEditingVocabValue] = useState('');
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editConversation, setEditConversation] = useState<any[]>([]);
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [npcLine, setNpcLine] = useState('');
  const [answers, setAnswers] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [editChapterOrder, setEditChapterOrder] = useState<number>(1);
  const [editChapterContext, setEditChapterContext] = useState('');
  const [editChapterImage, setEditChapterImage] = useState('');
  const [editChapterEmoji, setEditChapterEmoji] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulkVocabModal, setShowBulkVocabModal] = useState(false);
  const [bulkVocabText, setBulkVocabText] = useState('');
  const [editingVocabFields, setEditingVocabFields] = useState({ word: '', type: '', definition: '', example1: '', example2: '', equivalent: '' });
  const [showEmojiBulkModal, setShowEmojiBulkModal] = useState(false);
  const [emojiBulkText, setEmojiBulkText] = useState('');
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const fetchLessons = async () => {
    setRefreshing(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'lessons'));
      const lessonsData = querySnapshot.docs.map(doc => doc.data());
      setLessons(lessonsData);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setRefreshing(false);
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
    } catch (error: any) {
      console.error('Error fetching pending messages count:', error);
    }
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const adminStatus = !!userData.isAdmin;
            setIsAdmin(adminStatus);
            setUser(userData);
            
            if (!adminStatus) {
              Alert.alert('Access Denied', 'You do not have admin privileges.');
              navigation.goBack();
              return;
            }
            
            // If admin check passes, fetch lessons and pending messages count
            fetchLessons();
            fetchPendingMessagesCount();
          } else {
            Alert.alert('Access Denied', 'User not found.');
            navigation.goBack();
            return;
          }
        } else {
          Alert.alert('Access Denied', 'Please sign in to access admin panel.');
          navigation.goBack();
          return;
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        Alert.alert('Error', 'Failed to verify admin status.');
        navigation.goBack();
        return;
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [navigation]);

  // When a lesson is selected, load its title and conversation into local state
  useEffect(() => {
    if (selectedLesson) {
      setEditChapterTitle(selectedLesson.title || '');
      setEditConversation(selectedLesson.conversation || []);
      setEditChapterOrder(selectedLesson.order ?? 1);
      setEditChapterContext(selectedLesson.context || '');
      setEditChapterImage(selectedLesson.image || '');
      setEditChapterEmoji(selectedLesson.emoji || '');
    }
  }, [selectedLesson]);

  const handleAddChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      // Fetch current lessons to determine max order
      const querySnapshot = await getDocs(collection(db, 'lessons'));
      const lessonsData = querySnapshot.docs.map(doc => doc.data());
      const maxOrder = lessonsData.length > 0 ? Math.max(...lessonsData.map(l => l.order ?? 0)) : 0;
      await addDoc(collection(db, 'lessons'), {
        title: newChapterTitle,
        vocabulary: [], // Add empty vocabulary array
        conversation: [], // Add empty conversation array
        order: maxOrder + 1, // Set order to next available
      });
      setNewChapterTitle('');
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'lessons', id));
      setSelectedLesson(null);
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleAddDialogue = async () => {
    if (!selectedLesson || !newDialogue.trim()) return;
    try {
      const updatedDialogues = [...(selectedLesson.dialogues || []), newDialogue];
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        dialogues: updatedDialogues,
      });
      setNewDialogue('');
      setSelectedLesson({ ...selectedLesson, dialogues: updatedDialogues });
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteDialogue = async (index: number) => {
    if (!selectedLesson) return;
    try {
      const updatedDialogues = selectedLesson.dialogues.filter((_: any, i: number) => i !== index);
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        dialogues: updatedDialogues,
      });
      setSelectedLesson({ ...selectedLesson, dialogues: updatedDialogues });
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Add vocabulary word
  const handleAddVocab = async () => {
    if (!selectedLesson || !newVocab.trim()) return;
    try {
      const updatedVocab = [...(selectedLesson.vocabulary || []), newVocab.trim()];
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        vocabulary: updatedVocab,
      });
      setSelectedLesson({ ...selectedLesson, vocabulary: updatedVocab });
      setNewVocab('');
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Delete vocabulary word
  const handleDeleteVocab = async (index: number) => {
    if (!selectedLesson) return;
    try {
      const updatedVocab = selectedLesson.vocabulary.filter((_: any, i: number) => i !== index);
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        vocabulary: updatedVocab,
      });
      setSelectedLesson({ ...selectedLesson, vocabulary: updatedVocab });
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Start editing a vocabulary word
  const handleStartEditVocab = (index: number, value: any) => {
    setEditingVocabIndex(index);
    if (typeof value === 'string') {
      setEditingVocabFields({ word: value, type: '', definition: '', example1: '', example2: '', equivalent: '' });
    } else {
      setEditingVocabFields({
        word: value.word || '',
        type: value.type || '',
        definition: value.definition || '',
        example1: value.example1 || '',
        example2: value.example2 || '',
        equivalent: value.equivalent || '',
      });
    }
  };

  // Save edited vocabulary word
  const handleSaveEditVocab = async () => {
    if (!selectedLesson || editingVocabIndex === null) return;
    try {
      const updatedVocab = selectedLesson.vocabulary.map((v: any, i: number) =>
        i === editingVocabIndex ? { ...editingVocabFields } : v
      );
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        vocabulary: updatedVocab,
      });
      setSelectedLesson({ ...selectedLesson, vocabulary: updatedVocab });
      setEditingVocabIndex(null);
      setEditingVocabFields({ word: '', type: '', definition: '', example1: '', example2: '', equivalent: '' });
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Add or edit a question
  const handleSaveQuestion = () => {
    if (!npcLine.trim() || answers.some(a => !a.trim())) return;
    const question = {
      type: 'user',
      npcLine: npcLine.trim(),
      options: answers.map((text, i) => ({ text: text.trim(), isCorrect: i === correctIndex })),
    };
    let updated = [...editConversation];
    if (editingQuestionIndex !== null) {
      updated[editingQuestionIndex] = question;
    } else {
      updated.push(question);
    }
    setEditConversation(updated);
    setQuestionModalVisible(false);
    setNpcLine('');
    setAnswers(['', '', '', '']);
    setCorrectIndex(0);
    setEditingQuestionIndex(null);
  };

  // Open modal for editing a question
  const handleEditQuestion = (index: number) => {
    const q = editConversation[index];
    setNpcLine(q.npcLine || '');
    setAnswers(q.options ? q.options.map((o: any) => o.text) : ['', '', '', '']);
    setCorrectIndex(q.options ? q.options.findIndex((o: any) => o.isCorrect) : 0);
    setEditingQuestionIndex(index);
    setQuestionModalVisible(true);
  };

  // Open modal for adding a new question
  const handleAddQuestion = () => {
    setNpcLine('');
    setAnswers(['', '', '', '']);
    setCorrectIndex(0);
    setEditingQuestionIndex(null);
    setQuestionModalVisible(true);
  };

  // Delete a question
  const handleDeleteQuestion = (index: number) => {
    setEditConversation(editConversation.filter((_, i) => i !== index));
  };

  // Save all changes to Firestore
  const handleSaveAll = async () => {
    if (!selectedLesson) return;
    try {
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        title: editChapterTitle,
        conversation: editConversation,
        order: editChapterOrder,
        context: editChapterContext,
        image: editChapterImage,
        emoji: editChapterEmoji,
      });
      setSelectedLesson({ ...selectedLesson, title: editChapterTitle, conversation: editConversation, order: editChapterOrder, context: editChapterContext, image: editChapterImage, emoji: editChapterEmoji });
      Alert.alert('Success', 'Chapter updated!');
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Bulk add questions parser
  const handleBulkAdd = async () => {
    if (!selectedLesson) return;
    // Parse bulkText into questions
    const blocks = bulkText.split('/').map(b => b.trim()).filter(Boolean);
    const parsedQuestions = blocks.map(block => {
      // Remove leading/trailing ---
      const parts = block.split('---').map(l => l.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      const npcLine = parts[0];
      // Split options by '--'
      const optionsRaw = parts[1].split('--').map(o => o.trim()).filter(Boolean);
      const options = optionsRaw.map((text, i) => ({ text, isCorrect: i === 0 }));
      return {
        type: 'user',
        npcLine,
        options,
      };
    }).filter(Boolean);
    // Append to existing conversation
    const existingConversation = selectedLesson.conversation || [];
    const newConversation = [...existingConversation, ...parsedQuestions];
    // Update lesson
    try {
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        conversation: newConversation,
      });
      setSelectedLesson({ ...selectedLesson, conversation: newConversation });
      setShowBulkModal(false);
      setBulkText('');
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Handler for bulk add vocabulary
  const handleBulkAddVocab = async () => {
    if (!selectedLesson) return;
    // Parse bulkVocabText into vocab objects
    const blocks = bulkVocabText.split('/').map(b => b.trim()).filter(Boolean);
    const parsedVocab = blocks.map(block => {
      // Remove leading/trailing ---
      const parts = block.split('---').map(l => l.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      const word = parts[0];
      // Split rest by '--'
      const fields = parts[1].split('--').map(f => f.trim());
      if (fields.length < 5) return null;
      return {
        word,
        type: fields[0],
        definition: fields[1],
        example1: fields[2],
        example2: fields[3],
        equivalent: fields[4],
      };
    }).filter(Boolean);
    // Append to existing vocabulary
    const existingVocab = Array.isArray(selectedLesson.vocabulary) ? selectedLesson.vocabulary : [];
    const newVocab = [...existingVocab, ...parsedVocab];
    try {
      await updateDoc(doc(db, 'lessons', selectedLesson.id), {
        vocabulary: newVocab,
      });
      setSelectedLesson({ ...selectedLesson, vocabulary: newVocab });
      setShowBulkVocabModal(false);
      setBulkVocabText('');
      fetchLessons();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleBulkAddEmojiQuestions = async () => {
    if (!emojiBulkText.trim()) return;
    
    try {
      // Process the entire text as one string with multiple questions
      const fullText = emojiBulkText.trim();
      console.log('Processing full text length:', fullText.length);
      
      // Split by / to get individual dialogue blocks
      const dialogueBlocks = fullText.split('/').filter(block => block.trim());
      console.log('Total dialogue blocks found:', dialogueBlocks.length);
      
      let addedCount = 0;
      const questionsArray = [];
      
      for (const block of dialogueBlocks) {
        // Remove leading/trailing --- and split by ---
        const cleanBlock = block.replace(/^---|---$/g, '').trim();
        const parts = cleanBlock.split('---').filter(part => part.trim());
        
        if (parts.length < 6) {
          console.log('Skipping incomplete dialogue block:', cleanBlock.substring(0, 50) + '...');
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
        
        console.log('Processing dialogue block:', npcInfo.substring(0, 30) + '...');
        
        if (!npcInfo || !correctAnswerWithEmoji) {
          console.log('Skipping incomplete dialogue');
          continue;
        }
        
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
        const moodDescription = moodParts.slice(0, -1).join(' ').trim() || '';
        const moodEmoji = moodParts[moodParts.length - 1]?.trim() || '';
        
        // Store the complete mood string (description + emoji) in moodEmoji field
        const completeMoodString = moodWithEmoji.trim();
        
        const correct = parseAnswerEmoji(correctAnswerWithEmoji);
        const incorrect1 = parseAnswerEmoji(incorrectAnswer1WithEmoji);
        const incorrect2 = parseAnswerEmoji(incorrectAnswer2WithEmoji);
        const incorrect3 = parseAnswerEmoji(incorrectAnswer3WithEmoji);
        
        // Add question to array
        questionsArray.push({
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
        });
        
        addedCount++;
      }
      
      // Create single document with all questions
      if (questionsArray.length > 0) {
        await addDoc(collection(db, 'emojiQuestions'), {
          questions: questionsArray,
          createdAt: new Date(),
        });
      }
      
      Alert.alert('Success', `Added ${addedCount} emoji questions in 1 document`);
      setEmojiBulkText('');
      setShowEmojiBulkModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCleanupEmojiQuestions = async () => {
    try {
      // Delete all existing emoji questions
      const querySnapshot = await getDocs(collection(db, 'emojiQuestions'));
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      Alert.alert('Success', 'All existing emoji questions have been deleted. You can now add new ones with the correct format.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 18, color: 'red' }}>Access Denied: Admins Only</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: '#1976D2', fontWeight: 'bold', fontSize: 16 }}>{'< Back to Map'}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.messageIconContainer}
          onPress={() => navigation.navigate('Messages' as never)}
        >
          <Text style={styles.messageIcon}>💬</Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {pendingMessagesCount} pending
          </Text>
          {pendingMessagesCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>
                {pendingMessagesCount > 99 ? '99+' : pendingMessagesCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.header}>Admin Panel</Text>
      <Text style={styles.subheader}>Add New Chapter</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Chapter Title"
          value={newChapterTitle}
          onChangeText={setNewChapterTitle}
        />
        <Button title="Add" onPress={handleAddChapter} />
      </View>
      <Text style={styles.subheader}>Chapters</Text>
      <FlatList
        data={lessons}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.dayItem}
            onPress={() => setSelectedLesson(item)}
          >
            <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
            <Button title="Delete" color="red" onPress={() => handleDeleteChapter(item.id)} />
          </TouchableOpacity>
        )}
        refreshing={refreshing}
        onRefresh={fetchLessons}
      />
      {selectedLesson && (
        <ScrollView style={styles.dialogueSection}>
          {/* Editable Chapter Title */}
          <Text style={styles.subheader}>Edit Chapter Title</Text>
          <TextInput
            style={styles.input}
            value={editChapterTitle}
            onChangeText={setEditChapterTitle}
          />
          {/* Editable Chapter Number/Order */}
          <Text style={styles.subheader}>Chapter Number (Order)</Text>
          <TextInput
            style={styles.input}
            value={editChapterOrder.toString()}
            onChangeText={text => setEditChapterOrder(Number(text.replace(/[^0-9]/g, '')))}
            keyboardType="numeric"
          />
          {/* Editable Chapter Context */}
          <Text style={styles.subheader}>Chapter Context</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={editChapterContext}
            onChangeText={setEditChapterContext}
            placeholder="e.g., Alex is going to take a taxi to the city center now. Make sure he gets there."
            multiline
            numberOfLines={3}
          />
          {/* Editable Chapter Image */}
          <Text style={styles.subheader}>Chapter Image URL</Text>
          <TextInput
            style={styles.input}
            value={editChapterImage}
            onChangeText={setEditChapterImage}
            placeholder="e.g., https://example.com/image.jpg or https://images.unsplash.com/..."
          />
          {/* Editable Chapter Emoji */}
          <Text style={styles.subheader}>Chapter Emoji</Text>
          <TextInput
            style={styles.input}
            value={editChapterEmoji}
            onChangeText={setEditChapterEmoji}
            placeholder="e.g., 🚗 🏠 🍕 🎮 📚"
          />
          {/* Bulk Add Questions */}
          <Button title="Bulk Add Questions" onPress={() => setShowBulkModal(true)} color="#4CAF50" />
          <View style={{ height: 10 }} />
          {/* Vocabulary Section (unchanged) */}
          <Text style={styles.subheader}>Vocabulary for {editChapterTitle}</Text>
          <FlatList
            data={selectedLesson.vocabulary || []}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.dialogueItem}>
                {editingVocabIndex === index ? (
                  <View style={{ flex: 1 }}>
                    <TextInput style={styles.input} placeholder="Word" value={editingVocabFields.word} onChangeText={t => setEditingVocabFields(f => ({ ...f, word: t }))} />
                    <TextInput style={styles.input} placeholder="Type of Speech" value={editingVocabFields.type} onChangeText={t => setEditingVocabFields(f => ({ ...f, type: t }))} />
                    <TextInput style={styles.input} placeholder="Definition" value={editingVocabFields.definition} onChangeText={t => setEditingVocabFields(f => ({ ...f, definition: t }))} />
                    <TextInput style={styles.input} placeholder="Example 1" value={editingVocabFields.example1} onChangeText={t => setEditingVocabFields(f => ({ ...f, example1: t }))} />
                    <TextInput style={styles.input} placeholder="Example 2" value={editingVocabFields.example2} onChangeText={t => setEditingVocabFields(f => ({ ...f, example2: t }))} />
                    <TextInput style={styles.input} placeholder="Equivalent" value={editingVocabFields.equivalent} onChangeText={t => setEditingVocabFields(f => ({ ...f, equivalent: t }))} />
                    <Button title="Save" onPress={handleSaveEditVocab} />
                    <Button title="Cancel" color="gray" onPress={() => setEditingVocabIndex(null)} />
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>{item.word || item}</Text>
                    <Text style={{ color: '#555' }}>Type: {item.type || ''}</Text>
                    <Text style={{ color: '#555' }}>Definition: {item.definition || ''}</Text>
                    <Text style={{ color: '#555' }}>Ex1: {item.example1 || ''}</Text>
                    <Text style={{ color: '#555' }}>Ex2: {item.example2 || ''}</Text>
                    <Text style={{ color: '#555' }}>Equivalent: {item.equivalent || ''}</Text>
                    <Button title="Edit" onPress={() => handleStartEditVocab(index, item)} />
                    <Button title="Delete" color="red" onPress={() => handleDeleteVocab(index)} />
                  </View>
                )}
              </View>
            )}
          />
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="New Vocabulary Word"
              value={newVocab}
              onChangeText={setNewVocab}
            />
            <Button title="Add" onPress={handleAddVocab} />
          </View>
          <Button title="Bulk Add Vocabulary" onPress={() => setShowBulkVocabModal(true)} color="#4CAF50" />
          <Modal visible={showBulkVocabModal} animationType="slide">
            <View style={{ flex: 1, padding: 24, backgroundColor: '#fff' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Bulk Add Vocabulary</Text>
              <Text style={{ fontSize: 14, marginBottom: 8 }}>
                Format: ---word---type of speech--definition--example sentence1--example sentence2--equivalent--/
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, minHeight: 120, marginBottom: 16 }}
                multiline
                value={bulkVocabText}
                onChangeText={setBulkVocabText}
                placeholder={
                  '---create---verb-to make something out of nothing or with some materials--He created a masterpiece.--We need to create new ways of doing it.--yaratmak--/'
                }
              />
              <Button title="Add Vocabulary" onPress={handleBulkAddVocab} color="#4CAF50" />
              <View style={{ height: 12 }} />
              <Button title="Cancel" onPress={() => setShowBulkVocabModal(false)} color="#888" />
            </View>
          </Modal>
          {/* Questions Section */}
          <Text style={styles.subheader}>Questions for {editChapterTitle}</Text>
          {editConversation.map((q, i) => (
            <View key={i} style={styles.dialogueItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                <TouchableOpacity onPress={() => {
                  if (i > 0) {
                    const newArr = [...editConversation];
                    [newArr[i - 1], newArr[i]] = [newArr[i], newArr[i - 1]];
                    setEditConversation(newArr);
                  }
                }} disabled={i === 0}>
                  <Text style={{ fontSize: 20, color: i === 0 ? '#ccc' : '#1976D2', marginRight: 4 }}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (i < editConversation.length - 1) {
                    const newArr = [...editConversation];
                    [newArr[i + 1], newArr[i]] = [newArr[i], newArr[i + 1]];
                    setEditConversation(newArr);
                  }
                }} disabled={i === editConversation.length - 1}>
                  <Text style={{ fontSize: 20, color: i === editConversation.length - 1 ? '#ccc' : '#1976D2' }}>↓</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ flex: 2 }}>{q.npcLine || 'No NPC line'}</Text>
              <Button title="Edit" onPress={() => handleEditQuestion(i)} />
              <Button title="Delete" color="red" onPress={() => handleDeleteQuestion(i)} />
            </View>
          ))}
          <Button title="Add Question" onPress={handleAddQuestion} color="#1976D2" />
          <View style={{ height: 10 }} />
          <Button title="Save All" onPress={handleSaveAll} color="#4CAF50" />
          <View style={{ height: 10 }} />
          <Button title="Close" onPress={() => setSelectedLesson(null)} />
          {/* Question Modal */}
          <Modal
            visible={questionModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setQuestionModalVisible(false)}
          >
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
              <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 18, width: '95%', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: '#1976D2' }}>NPC Line</Text>
                <TextInput
                  style={styles.input}
                  placeholder="NPC says..."
                  value={npcLine}
                  onChangeText={setNpcLine}
                />
                <Text style={{ fontWeight: 'bold', fontSize: 16, marginTop: 18, marginBottom: 8, color: '#1976D2' }}>User Answers</Text>
                {answers.map((ans, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 0 }]}
                      placeholder={`Answer ${idx + 1}`}
                      value={ans}
                      onChangeText={text => setAnswers(answers.map((a, i) => i === idx ? text : a))}
                    />
                    <TouchableOpacity onPress={() => setCorrectIndex(idx)} style={{ marginLeft: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: correctIndex === idx ? '#4CAF50' : '#e0e0e0' }}>
                      <Text style={{ color: correctIndex === idx ? '#fff' : '#555', fontWeight: 'bold' }}>
                        {correctIndex === idx ? '✔ Correct' : 'Mark Correct'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24 }}>
                  <Button title="Cancel" color="#b0bec5" onPress={() => setQuestionModalVisible(false)} />
                  <View style={{ width: 16 }} />
                  <Button title={editingQuestionIndex !== null ? 'Save' : 'Add'} color="#1976D2" onPress={handleSaveQuestion} />
                </View>
              </View>
            </View>
          </Modal>
          
          {/* Save Changes Button for Chapter Edit */}
          <View style={{ marginTop: 24, marginBottom: 20, paddingHorizontal: 16 }}>
            <Button title="Save Changes" onPress={handleSaveAll} color="#1976D2" />
        </View>
        </ScrollView>
      )}
      {/* Bulk Add Modal */}
      <Modal
        visible={showBulkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBulkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bulkModalContent}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Bulk Add Questions</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
              Paste your questions in the format:<br/>---NPC line---Correct answer--Wrong 1--Wrong 2--Wrong 3--/
            </Text>
            <TextInput
              style={styles.bulkInput}
              multiline
              numberOfLines={8}
              placeholder={"---NPC line---Correct answer--Wrong 1--Wrong 2--Wrong 3--/\n---..."}
              value={bulkText}
              onChangeText={setBulkText}
            />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Button title="Cancel" color="#666" onPress={() => setShowBulkModal(false)} />
              <View style={{ width: 16 }} />
              <Button title="Add" color="#4CAF50" onPress={handleBulkAdd} />
            </View>
          </View>
        </View>
      </Modal>
      <View style={{ padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' }}>
        <Button title="Save Changes" onPress={handleSaveAll} color="#1976D2" />
      </View>
      {/* Emoji Questions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emoji Questions</Text>
        <Text style={styles.sectionSubtitle}>
          Add mood-based questions in bulk format:
        </Text>
        <Text style={styles.formatText}>
          Format: ---npc sentence---correct answer-emoji---incorrect1-emoji---incorrect2-emoji---incorrect3-emoji---mood-emoji
        </Text>
        <Text style={styles.exampleText}>
          Example: ---What is your purpose of visit?---I have applied for a language course-🙂---I do not want to share it with you.-😡---Is there something wrong with my files?-😥---I knew there was something wrong.-😭---happy-🙂
        </Text>
        <Text style={styles.noteText}>
          Note: Each answer should be in format "text-emoji" (text followed by dash and emoji). You can add multiple questions, one per line.
        </Text>
        
        <TouchableOpacity
          style={styles.bulkButton}
          onPress={() => setShowEmojiBulkModal(true)}
        >
          <Text style={styles.bulkButtonText}>Add Emoji Questions in Bulk</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.bulkButton, { backgroundColor: '#f44336', marginTop: 12 }]}
          onPress={handleCleanupEmojiQuestions}
        >
          <Text style={styles.bulkButtonText}>Clean Up Existing Questions</Text>
        </TouchableOpacity>
      </View>

      {/* Emoji Bulk Modal */}
      <Modal
        visible={showEmojiBulkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmojiBulkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Emoji Questions in Bulk</Text>
            <Text style={styles.modalSubtitle}>
              Enter questions in the format: ---npc sentence---correct answer-emoji---incorrect1-emoji---incorrect2-emoji---incorrect3-emoji---mood-emoji
            </Text>
            <Text style={styles.modalSubtitle}>
              Each answer should be "text-emoji" (text followed by dash and emoji)
            </Text>
            
            <TextInput
              style={styles.bulkTextInput}
              multiline
              numberOfLines={10}
              placeholder="Paste your questions here..."
              value={emojiBulkText}
              onChangeText={setEmojiBulkText}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEmojiBulkModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleBulkAddEmojiQuestions}
              >
                <Text style={styles.modalButtonText}>Add Questions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  subheader: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12, color: '#1976D2', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#b0bec5', borderRadius: 10, padding: 10, marginRight: 8, backgroundColor: '#f5f7fa', fontSize: 16 },
  dayItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: '#e3e3e3', backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  dialogueSection: { marginTop: 24, padding: 18, backgroundColor: '#f0f4f8', borderRadius: 14, minHeight: 400 },
  dialogueItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bulkModalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: 340,
    alignItems: 'center',
  },
  bulkInput: {
    width: 300,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    textAlignVertical: 'top',
  },
  section: {
    marginTop: 24,
    padding: 18,
    backgroundColor: '#f0f4f8',
    borderRadius: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1976D2',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  formatText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
  },
  noteText: {
    fontSize: 12,
    color: '#1976D2',
    fontStyle: 'italic',
    marginTop: 4,
  },
  bulkButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1976D2',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: '#555',
    textAlign: 'center',
  },
  bulkTextInput: {
    width: 300,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#b0bec5',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  messageIconContainer: {
    position: 'relative',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  messageIcon: {
    fontSize: 24,
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

export default AdminPanelScreen;
