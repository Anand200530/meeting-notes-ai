import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList,
  Modal, Alert, ActivityIndicator, ScrollView, Share, SafeAreaView, 
  StatusBar, Clipboard, Linking, Platform
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { processMeeting, hasApiKey } from '../src/services/aiService';

// Demo data
const DEMO_MEETINGS = [
  {
    id: '1',
    title: 'Weekly Team Standup',
    duration: '15:32',
    date: new Date().toISOString(),
    aiSummary: {
      summary: 'Weekly team standup covering progress and plans for the sprint.',
      keyPoints: ['Review of last week deliverables', 'Current sprint planning', 'Blocker discussion'],
      actionItems: ['Complete API docs', 'Review PR #42', 'Schedule design sync'],
    },
    folder: 'Work',
  },
  {
    id: '2',
    title: 'Product Review',
    duration: '28:15',
    date: new Date(Date.now() - 86400000).toISOString(),
    aiSummary: {
      summary: 'Product review for new feature launch with beta feedback discussion.',
      keyPoints: ['Beta launch results', 'User feedback themes', 'Prioritization for next iteration'],
      actionItems: ['Analyze feedback data', 'Create improvement backlog', 'Plan v2 rollout'],
    },
    folder: 'Product',
  },
];

const FOLDERS = ['All', 'Work', 'Product', 'Personal'];
const COLORS = {
  primary: '#1a1a1a',
  background: '#f8f9fa',
  card: '#ffffff',
  accent: '#2563eb',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
};

export default function HomeScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState(DEMO_MEETINGS);
  const [folder, setFolder] = useState('All');
  const [search, setSearch] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  
  // Recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [recFolder, setRecFolder] = useState('Work');
  const [timer, setTimer] = useState(null);

  // Detail state
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Load API key from storage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('@settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setApiKey(parsed.openai || '');
      }
    } catch (e) {
      console.log('Error loading settings:', e);
    }
  };

  const saveApiKey = async (key) => {
    try {
      await AsyncStorage.setItem('@settings', JSON.stringify({ openai: key }));
      setApiKey(key);
    } catch (e) {
      console.log('Error saving settings:', e);
    }
  };

  const filtered = meetings.filter(m => {
    const matchFolder = folder === 'All' || m.folder === folder;
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchSearch;
  });

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record.');
        return;
      }
      
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      setDuration(0);
      
      const newTimer = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
      setTimer(newTimer);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording: ' + e.message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
    
    setIsRecording(false);
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      
      const newMeeting = {
        id: Date.now().toString(),
        title: title || `Meeting ${meetings.length + 1}`,
        duration: formatTime(duration),
        date: new Date().toISOString(),
        audioUri: uri,
        folder: recFolder,
      };
      
      setMeetings([newMeeting, ...meetings]);
      setShowRecord(false);
      setTitle('');
      setDuration(0);
      setRecording(null);
    } catch (e) {
      Alert.alert('Error', 'Could not save recording: ' + e.message);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Export functions
  const exportAsText = (meeting) => {
    let text = `${meeting.title}\n`;
    text += `Duration: ${meeting.duration}\n`;
    text += `Date: ${new Date(meeting.date).toLocaleDateString()}\n`;
    text += `Folder: ${meeting.folder}\n\n`;
    
    if (meeting.aiSummary) {
      text += `SUMMARY:\n${meeting.aiSummary.summary}\n\n`;
      text += `KEY POINTS:\n`;
      meeting.aiSummary.keyPoints?.forEach(p => text += `• ${p}\n`);
      text += `\nACTION ITEMS:\n`;
      meeting.aiSummary.actionItems?.forEach(a => text += `✓ ${a}\n`);
      if (meeting.aiSummary.questions?.length) {
        text += `\nQUESTIONS:\n`;
        meeting.aiSummary.questions?.forEach(q => text += `? ${q}\n`);
      }
    }
    
    if (meeting.transcript) {
      text += `\nTRANSCRIPT:\n${meeting.transcript}`;
    }
    
    return text;
  };

  const handleShare = async () => {
    if (!selected?.aiSummary) {
      Alert.alert('No Summary', 'Please generate an AI summary first.');
      return;
    }
    const text = exportAsText(selected);
    try {
      await Share.share({ message: text });
    } catch (e) {
      Alert.alert('Error', 'Could not share: ' + e.message);
    }
  };

  const handleCopy = () => {
    if (!selected?.aiSummary) return;
    const text = exportAsText(selected);
    Clipboard.setString(text);
    Alert.alert('Copied', 'Summary copied to clipboard!');
  };

  const handleProcess = async () => {
    if (!selected) return;
    
    setProcessing(true);
    setProcessingStatus('processing');
    
    try {
      const processed = await processMeeting(selected, apiKey, (status) => {
        setProcessingStatus(status);
      });
      
      // Update meeting in list
      setMeetings(meetings.map(m => m.id === selected.id ? processed : m));
      setSelected(processed);
      Alert.alert('Success', 'AI summary generated!');
    } catch (e) {
      Alert.alert('Error', 'Processing failed: ' + e.message);
    } finally {
      setProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Meeting', 'Are you sure you want to delete this meeting?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: () => {
          setMeetings(meetings.filter(m => m.id !== selected?.id));
          setSelected(null);
        }
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDuration}>{item.duration}</Text>
        {item.aiSummary && <Text style={styles.aiTag}>AI</Text>}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meeting Notes AI</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsBtn}>SETTINGS</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput 
          style={styles.searchInput} 
          placeholder="Search meetings..." 
          value={search} 
          onChangeText={setSearch} 
        />
      </View>

      {/* Folders */}
      <View style={styles.folders}>
        {FOLDERS.map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.folder, folder === f && styles.folderActive]} 
            onPress={() => setFolder(f)}
          >
            <Text style={[styles.folderText, folder === f && styles.folderTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={i => i.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎙️</Text>
            <Text style={styles.emptyText}>No meetings yet</Text>
            <Text style={styles.emptySub}>Tap + to record</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowRecord(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Record Modal */}
      <Modal visible={showRecord} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>NEW RECORDING</Text>
              <TouchableOpacity onPress={() => { setShowRecord(false); if (timer) clearInterval(timer); }}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput 
              style={styles.titleInput} 
              placeholder="Meeting title..." 
              value={title} 
              onChangeText={setTitle} 
            />
            
            <View style={styles.folderSelect}>
              {FOLDERS.slice(1).map(f => (
                <TouchableOpacity 
                  key={f} 
                  style={[styles.chip, recFolder === f && styles.chipActive]} 
                  onPress={() => setRecFolder(f)}
                >
                  <Text style={[styles.chipText, recFolder === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.recArea}>
              <TouchableOpacity 
                style={[styles.recBtn, isRecording && styles.recBtnActive]} 
                onPressIn={startRecording} 
                onPressOut={stopRecording}
              >
                <View style={[styles.recBtnInner, isRecording && styles.recBtnInnerActive]}>
                  <Text style={styles.recIcon}>{isRecording ? 'STOP' : 'REC'}</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.recTime}>
                {isRecording ? `Recording ${formatTime(duration)}` : 'Hold to record'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>API SETTINGS</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.apiLabel}>OpenAI API Key</Text>
            <TextInput 
              style={styles.apiInput} 
              placeholder="sk-..." 
              secureTextEntry 
              value={apiKey} 
              onChangeText={saveApiKey} 
            />
            <Text style={styles.apiHint}>
              Get your API key from {'\n'}platform.openai.com/api-keys
            </Text>
            
            {apiKey && (
              <View style={styles.apiStatus}>
                <Text style={styles.apiStatusText}>
                  {hasApiKey(apiKey) ? '✓ API Key configured' : '✗ Invalid format'}
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.linkBtn}
              onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}
            >
              <Text style={styles.linkBtnText}>Get OpenAI API Key →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.detailOverlay}>
          <View style={styles.detail}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.backBtn}>← BACK</Text>
              </TouchableOpacity>
              <View style={styles.detailActions}>
                <TouchableOpacity onPress={handleShare}>
                  <Text style={styles.actionBtn}>SHARE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCopy}>
                  <Text style={styles.actionBtn}>COPY</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete}>
                  <Text style={[styles.actionBtn, {color: COLORS.error}]}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.detailContent}>
              <Text style={styles.detailTitle}>{selected?.title}</Text>
              <Text style={styles.detailMeta}>
                {selected?.duration} • {selected?.folder} • {new Date(selected?.date).toLocaleDateString()}
              </Text>
              
              {/* Process Button */}
              {!selected?.aiSummary && !processing && (
                <TouchableOpacity style={styles.processBtn} onPress={handleProcess}>
                  <Text style={styles.processBtnText}>GENERATE AI SUMMARY</Text>
                </TouchableOpacity>
              )}
              
              {/* Processing State */}
              {processing && (
                <View style={styles.processingBox}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.processingText}>
                    {processingStatus === 'transcribing' && 'Transcribing audio...'}
                    {processingStatus === 'summarizing' && 'Generating summary...'}
                    {processingStatus === 'demo' && 'Processing...'}
                    {processingStatus === 'processing' && 'Processing...'}
                  </Text>
                </View>
              )}
              
              {/* AI Summary Display */}
              {selected?.aiSummary && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SUMMARY</Text>
                    <Text style={styles.sectionText}>{selected.aiSummary.summary}</Text>
                  </View>
                  
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>KEY POINTS</Text>
                    {selected.aiSummary.keyPoints?.map((p, i) => (
                      <View key={i} style={styles.listItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.listText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACTION ITEMS</Text>
                    {selected.aiSummary.actionItems?.map((a, i) => (
                      <View key={i} style={styles.listItem}>
                        <Text style={styles.bulletSuccess}>✓</Text>
                        <Text style={styles.listText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {selected.aiSummary.questions?.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>QUESTIONS RAISED</Text>
                      {selected.aiSummary.questions?.map((q, i) => (
                        <View key={i} style={styles.listItem}>
                          <Text style={styles.bulletQuestion}>?</Text>
                          <Text style={styles.listText}>{q}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {selected?.transcript && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>TRANSCRIPT</Text>
                      <Text style={styles.transcript}>{selected.transcript}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: 50, 
    backgroundColor: COLORS.card, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  settingsBtn: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  searchBox: { padding: 16, backgroundColor: COLORS.card },
  searchInput: { backgroundColor: COLORS.background, padding: 12, borderRadius: 12, fontSize: 16 },
  folders: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    backgroundColor: COLORS.card, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  folder: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, borderRadius: 20, backgroundColor: COLORS.background },
  folderActive: { backgroundColor: COLORS.primary },
  folderText: { fontSize: 13, color: COLORS.textSecondary },
  folderTextActive: { color: COLORS.card },
  list: { padding: 16 },
  row: { justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDuration: { fontSize: 12, color: COLORS.textSecondary },
  aiTag: { fontSize: 10, backgroundColor: COLORS.accent, color: COLORS.card, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  cardDate: { fontSize: 12, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  fabIcon: { fontSize: 28, color: COLORS.card },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  modalClose: { fontSize: 20, color: COLORS.textSecondary },
  titleInput: { backgroundColor: COLORS.background, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  folderSelect: { flexDirection: 'row', marginBottom: 24 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: COLORS.background, marginRight: 8 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.card },
  recArea: { alignItems: 'center', paddingVertical: 20 },
  recBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  recBtnActive: { backgroundColor: COLORS.error },
  recBtnInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  recBtnInnerActive: { backgroundColor: COLORS.card },
  recIcon: { fontSize: 14, fontWeight: '700', color: COLORS.card },
  recTime: { fontSize: 14, color: COLORS.textSecondary },
  apiLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  apiInput: { backgroundColor: COLORS.background, padding: 14, borderRadius: 12, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  apiHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  apiStatus: { marginTop: 16, padding: 12, backgroundColor: COLORS.background, borderRadius: 8 },
  apiStatusText: { fontSize: 14, color: COLORS.success },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: COLORS.card, fontWeight: '700' },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkBtnText: { color: COLORS.accent, fontSize: 14 },
  detailOverlay: { flex: 1, backgroundColor: COLORS.background },
  detail: { flex: 1, backgroundColor: COLORS.background },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },
  detailActions: { flexDirection: 'row', gap: 16 },
  actionBtn: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  detailContent: { flex: 1, padding: 20 },
  detailTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  detailMeta: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 24 },
  processBtn: { backgroundColor: COLORS.accent, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  processBtnText: { color: COLORS.card, fontWeight: '700' },
  processingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 24, gap: 12 },
  processingText: { fontSize: 14, color: COLORS.textSecondary },
  section: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.accent, letterSpacing: 1, marginBottom: 12 },
  sectionText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  listItem: { flexDirection: 'row', marginBottom: 8 },
  bullet: { fontSize: 14, marginRight: 8, color: COLORS.accent },
  bulletSuccess: { fontSize: 14, marginRight: 8, color: COLORS.success },
  bulletQuestion: { fontSize: 14, marginRight: 8, color: COLORS.warning, fontWeight: '700' },
  listText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 22 },
  transcript: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 20 },
});
