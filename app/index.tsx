import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList,
  Modal, Alert, ActivityIndicator, ScrollView, Share, SafeAreaView, 
  StatusBar, Clipboard, Linking, Platform
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { processMeeting, hasApiKey } from '../src/services/aiService';

// Demo data
const DEMO_MEETINGS = [
  {
    id: '1',
    title: 'Weekly Team Standup',
    duration: '15:32',
    date: new Date().toISOString(),
    speakers: ['John', 'Sarah', 'Mike'],
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
    speakers: ['Emma', 'Alex'],
    aiSummary: {
      summary: 'Product review for new feature launch with beta feedback discussion.',
      keyPoints: ['Beta launch results', 'User feedback themes', 'Prioritization for next iteration'],
      actionItems: ['Analyze feedback data', 'Create improvement backlog', 'Plan v2 rollout'],
    },
    folder: 'Product',
  },
];

const FOLDERS = ['All', 'Work', 'Product', 'Personal'];
const SPEAKERS = ['Speaker 1', 'Speaker 2', 'Speaker 3', 'John', 'Sarah', 'Mike', 'Emma', 'Alex'];
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
  const [selectedSpeakers, setSelectedSpeakers] = useState([]);
  const [timer, setTimer] = useState(null);

  // Detail state
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

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
      
      const newTimer = setInterval(() => setDuration(d => d + 1), 1000);
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
        speakers: selectedSpeakers,
      };
      
      setMeetings([newMeeting, ...meetings]);
      setShowRecord(false);
      setTitle('');
      setDuration(0);
      setRecording(null);
      setSelectedSpeakers([]);
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
    text += `Folder: ${meeting.folder}\n`;
    if (meeting.speakers?.length) text += `Speakers: ${meeting.speakers.join(', ')}\n`;
    text += '\n';
    
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
    return text;
  };

  const exportAsPDF = async (meeting) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 8px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #2563eb; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-left: 8px; }
    .section { margin-bottom: 24px; }
    h2 { color: #2563eb; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    p { color: #1f2937; line-height: 1.6; }
    ul { padding-left: 20px; }
    li { color: #1f2937; line-height: 1.8; }
    .action { color: #22c55e; }
    .question { color: #f59e0b; }
    .speakers { background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>${meeting.title}<span class="badge">AI Summary</span></h1>
  <div class="meta">
    ${meeting.duration} • ${meeting.folder} • ${new Date(meeting.date).toLocaleDateString()}
  </div>
  ${meeting.speakers?.length ? `<div class="speakers"><strong>Speakers:</strong> ${meeting.speakers.join(', ')}</div>` : ''}
  
  ${meeting.aiSummary ? `
  <div class="section">
    <h2>Summary</h2>
    <p>${meeting.aiSummary.summary}</p>
  </div>
  
  <div class="section">
    <h2>Key Points</h2>
    <ul>
      ${meeting.aiSummary.keyPoints?.map(p => `<li>${p}</li>`).join('')}
    </ul>
  </div>
  
  <div class="section">
    <h2>Action Items</h2>
    <ul>
      ${meeting.aiSummary.actionItems?.map(a => `<li class="action">✓ ${a}</li>`).join('')}
    </ul>
  </div>
  
  ${meeting.aiSummary.questions?.length ? `
  <div class="section">
    <h2>Questions Raised</h2>
    <ul>
      ${meeting.aiSummary.questions?.map(q => `<li class="question">? ${q}</li>`).join('')}
    </ul>
  </div>
  ` : ''}
  ` : '<p>No AI summary generated yet.</p>'}
  
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    Generated by Meeting Notes AI
  </div>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Meeting Notes',
        UTI: 'com.adobe.pdf'
      });
    } catch (e) {
      Alert.alert('Error', 'Could not export PDF: ' + e.message);
    }
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

  const handlePDF = () => {
    if (!selected) return;
    exportAsPDF(selected);
  };

  const handleProcess = async () => {
    if (!selected) return;
    setProcessing(true);
    setProcessingStatus('processing');
    
    try {
      const processed = await processMeeting(selected, apiKey, (status) => {
        setProcessingStatus(status);
      });
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
    Alert.alert('Delete Meeting', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setMeetings(meetings.filter(m => m.id !== selected?.id));
        setSelected(null);
      }},
    ]);
  };

  const toggleSpeaker = (speaker) => {
    setSelectedSpeakers(prev => 
      prev.includes(speaker) 
        ? prev.filter(s => s !== speaker)
        : [...prev, speaker]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDuration}>{item.duration}</Text>
        {item.aiSummary && <Text style={styles.aiTag}>AI</Text>}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
      {item.speakers?.length > 0 && (
        <Text style={styles.cardSpeakers}>{item.speakers.length} speaker(s)</Text>
      )}
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
        <TextInput style={styles.searchInput} placeholder="Search meetings..." value={search} onChangeText={setSearch} />
      </View>

      {/* Folders */}
      <View style={styles.folders}>
        {FOLDERS.map(f => (
          <TouchableOpacity key={f} style={[styles.folder, folder === f && styles.folderActive]} onPress={() => setFolder(f)}>
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
            
            <TextInput style={styles.titleInput} placeholder="Meeting title..." value={title} onChangeText={setTitle} />
            
            <View style={styles.folderSelect}>
              {FOLDERS.slice(1).map(f => (
                <TouchableOpacity key={f} style={[styles.chip, recFolder === f && styles.chipActive]} onPress={() => setRecFolder(f)}>
                  <Text style={[styles.chipText, recFolder === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Speaker Tags */}
            <Text style={styles.speakerLabel}>Speakers (optional)</Text>
            <View style={styles.speakerSelect}>
              {SPEAKERS.map(speaker => (
                <TouchableOpacity 
                  key={speaker} 
                  style={[styles.speakerChip, selectedSpeakers.includes(speaker) && styles.speakerChipActive]} 
                  onPress={() => toggleSpeaker(speaker)}
                >
                  <Text style={[styles.speakerChipText, selectedSpeakers.includes(speaker) && styles.speakerChipTextActive]}>{speaker}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.recArea}>
              <TouchableOpacity style={[styles.recBtn, isRecording && styles.recBtnActive]} onPressIn={startRecording} onPressOut={stopRecording}>
                <View style={[styles.recBtnInner, isRecording && styles.recBtnInnerActive]}>
                  <Text style={styles.recIcon}>{isRecording ? 'STOP' : 'REC'}</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.recTime}>{isRecording ? `Recording ${formatTime(duration)}` : 'Hold to record'}</Text>
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
              <TouchableOpacity onPress={() => setShowSettings(false)}><Text style={styles.modalClose}>X</Text></TouchableOpacity>
            </View>
            
            <Text style={styles.apiLabel}>OpenAI API Key</Text>
            <TextInput style={styles.apiInput} placeholder="sk-..." secureTextEntry value={apiKey} onChangeText={saveApiKey} />
            <Text style={styles.apiHint}>Get your API key from platform.openai.com/api-keys</Text>
            
            {apiKey && <View style={styles.apiStatus}><Text style={styles.apiStatusText}>{hasApiKey(apiKey) ? '✓ API Key configured' : '✗ Invalid format'}</Text></View>}
            
            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
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
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.backBtn}>← BACK</Text></TouchableOpacity>
              <View style={styles.detailActions}>
                <TouchableOpacity onPress={handlePDF}><Text style={styles.actionBtn}>PDF</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleShare}><Text style={styles.actionBtn}>SHARE</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleCopy}><Text style={styles.actionBtn}>COPY</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleDelete}><Text style={[styles.actionBtn, {color: COLORS.error}]}>DEL</Text></TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.detailContent}>
              <Text style={styles.detailTitle}>{selected?.title}</Text>
              <Text style={styles.detailMeta}>{selected?.duration} • {selected?.folder} • {new Date(selected?.date).toLocaleDateString()}</Text>
              
              {selected?.speakers?.length > 0 && (
                <View style={styles.speakersBox}>
                  <Text style={styles.speakersLabel}>Speakers</Text>
                  <View style={styles.speakersRow}>
                    {selected.speakers.map((s, i) => (
                      <Text key={i} style={styles.speakerBadge}>{s}</Text>
                    ))}
                  </View>
                </View>
              )}
              
              {!selected?.aiSummary && !processing && (
                <TouchableOpacity style={styles.processBtn} onPress={handleProcess}>
                  <Text style={styles.processBtnText}>GENERATE AI SUMMARY</Text>
                </TouchableOpacity>
              )}
              
              {processing && (
                <View style={styles.processingBox}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.processingText}>
                    {processingStatus === 'transcribing' ? 'Transcribing audio...' : 
                     processingStatus === 'summarizing' ? 'Generating summary...' : 'Processing...'}
                  </Text>
                </View>
              )}
              
              {selected?.aiSummary && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SUMMARY</Text>
                    <Text style={styles.sectionText}>{selected.aiSummary.summary}</Text>
                  </View>
                  
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>KEY POINTS</Text>
                    {selected.aiSummary.keyPoints?.map((p, i) => (
                      <View key={i} style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>{p}</Text></View>
                    ))}
                  </View>
                  
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACTION ITEMS</Text>
                    {selected.aiSummary.actionItems?.map((a, i) => (
                      <View key={i} style={styles.listItem}><Text style={styles.bulletSuccess}>✓</Text><Text style={styles.listText}>{a}</Text></View>
                    ))}
                  </View>
                  
                  {selected.aiSummary.questions?.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>QUESTIONS</Text>
                      {selected.aiSummary.questions?.map((q, i) => (
                        <View key={i} style={styles.listItem}><Text style={styles.bulletQuestion}>?</Text><Text style={styles.listText}>{q}</Text></View>
                      ))}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  settingsBtn: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  searchBox: { padding: 16, backgroundColor: COLORS.card },
  searchInput: { backgroundColor: COLORS.background, padding: 12, borderRadius: 12, fontSize: 16 },
  folders: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
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
  cardSpeakers: { fontSize: 11, color: COLORS.warning, marginTop: 4 },
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
  folderSelect: { flexDirection: 'row', marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: COLORS.background, marginRight: 8 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.card },
  speakerLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  speakerSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  speakerChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  speakerChipActive: { backgroundColor: COLORS.warning, borderColor: COLORS.warning },
  speakerChipText: { fontSize: 12, color: COLORS.textSecondary },
  speakerChipTextActive: { color: COLORS.card },
  recArea: { alignItems: 'center', paddingVertical: 20 },
  recBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  recBtnActive: { backgroundColor: COLORS.error },
  recBtnInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  recBtnInnerActive: { backgroundColor: COLORS.card },
  recIcon: { fontSize: 14, fontWeight: '700', color: COLORS.card },
  recTime: { fontSize: 14, color: COLORS.textSecondary },
  apiLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  apiInput: { backgroundColor: COLORS.background, padding: 14, borderRadius: 12, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  apiHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
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
  detailActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  detailContent: { flex: 1, padding: 20 },
  detailTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  detailMeta: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  speakersBox: { backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 20 },
  speakersLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  speakersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  speakerBadge: { fontSize: 12, backgroundColor: COLORS.warning, color: COLORS.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
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
});
