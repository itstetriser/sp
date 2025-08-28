import { useNavigation } from '@react-navigation/native';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface SupportMessage {
  id: string;
  userId: string;
  userEmail: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'completed';
}

const MessagesScreen = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const fetchMessages = async () => {
    setRefreshing(true);
    try {
      const messagesQuery = query(
        collection(db, 'supportMessages'),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(messagesQuery);
      const messagesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportMessage[];
      setMessages(messagesData);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleMessagePress = (message: SupportMessage) => {
    setSelectedMessage(message);
    setShowMessageModal(true);
  };

  const markAsCompleted = async () => {
    if (!selectedMessage) return;

    try {
      const messageRef = doc(db, 'supportMessages', selectedMessage.id);
      await updateDoc(messageRef, {
        status: 'completed'
      });

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === selectedMessage.id 
          ? { ...msg, status: 'completed' as const }
          : msg
      ));

      Alert.alert('Success', 'Message marked as completed');
      setShowMessageModal(false);
      setSelectedMessage(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    return status === 'pending' ? '#FF6B35' : '#4CAF50';
  };

  const getStatusText = (status: string) => {
    return status === 'pending' ? 'PENDING' : 'COMPLETED';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.primaryText }]}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.primary }]}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
          Support Messages
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.messageItem, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}
            onPress={() => handleMessagePress(item)}
          >
            <View style={styles.messageHeader}>
              <Text style={[styles.userEmail, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                {item.userEmail}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={[styles.statusText, { fontSize: getScaledFontSize(12) }]}>
                  {getStatusText(item.status)}
                </Text>
              </View>
            </View>
            <Text 
              style={[styles.messagePreview, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}
              numberOfLines={2}
            >
              {item.message}
            </Text>
            <Text style={[styles.timestamp, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>
              {formatDate(item.timestamp)}
            </Text>
          </TouchableOpacity>
        )}
        refreshing={refreshing}
        onRefresh={fetchMessages}
        contentContainerStyle={styles.listContainer}
      />

      {/* Message Detail Modal */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            {selectedMessage && (
              <>
                <Text style={[styles.modalTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
                  Message Details
                </Text>
                
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                    From:
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    {selectedMessage.userEmail}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                    Date:
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    {formatDate(selectedMessage.timestamp)}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                    Status:
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedMessage.status) }]}>
                    <Text style={[styles.statusText, { fontSize: getScaledFontSize(12) }]}>
                      {getStatusText(selectedMessage.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                    Message:
                  </Text>
                  <Text style={[styles.messageText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                    {selectedMessage.message}
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  {selectedMessage.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.completeButton, { backgroundColor: theme.primary }]}
                      onPress={markAsCompleted}
                    >
                      <Text style={[styles.completeButtonText, { fontSize: getScaledFontSize(16) }]}>
                        Mark as Completed
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: theme.surfaceColor }]}
                    onPress={() => setShowMessageModal(false)}
                  >
                    <Text style={[styles.closeButtonText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 50,
  },
  listContainer: {
    padding: 16,
  },
  messageItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userEmail: {
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
  },
  messagePreview: {
    marginBottom: 8,
    lineHeight: 20,
  },
  timestamp: {
    fontStyle: 'italic',
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontWeight: '500',
  },
  messageText: {
    lineHeight: 24,
    marginTop: 8,
  },
  modalButtons: {
    marginTop: 24,
    gap: 12,
  },
  completeButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontWeight: '600',
  },
});

export default MessagesScreen;

