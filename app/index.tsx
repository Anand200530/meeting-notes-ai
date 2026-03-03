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

const DEMO_MEETINGS = [
  { id: '1', title: 'Weekly Team Standup', duration: '15:32', date: new Date().toISOString(), speakers: [], aiSummary: null, folder: 'Work', hasAudio: false },
  { id: '2', title: 'Product Review', duration: '28:15', date: new Date(Date.now() - 86400000).toISOString(), speakers: [], aiSummary: null, folder: 'Product', hasAudio: false },
];

const FOLDERS = ['All', 'Work', 'Product', 'Personal'];
const COLORS = { primary: '#1a1a1a', background: '#f8f9fa', card: '#ffffff', accent: '#2563eb', success: '#22c55e', error: '#ef4444', warning: '#f59e0b', text: '#1f2937', textSecondary: '#6b7280', border: '#e5e7eb' };

export default function HomeScreen() {
  const [meetings, setMeetings] = useState(DEMO_MEETINGS);
  const [folder, setFolder] = useState('All');
  const [search, setSearch] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [recFolder, setRecFolder] = useState('Work');
  const [speakerInput, setSpeakerInput] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [timer, setTimer] = useState(null);
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('@settings');
      if (settings) setApiKey(JSON.parse(settings).openai || '');
    } catch {}
  };

  const saveApiKey = async (key) => {
    setApiKey(key);
    try { await AsyncStorage.setItem('@settings', JSON.stringify({ openai: key })); } catch {}
  };

  const filtered = meetings.filter(m => (folder === 'All' || m.folder === folder) && m.title.toLowerCase().includes(search.toLowerCase()));

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Required', 'Please grant microphone permission.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      setDuration(0);
      setTimer(setInterval(() => setDuration(d => d + 1), 1000));
    } catch (e) { Alert.alert('Error', 'Could not start recording'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    if (timer) clearInterval(timer);
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const newMeeting = { id: Date.now().toString(), title: title || 'Meeting ' + (meetings.length + 1), duration: formatTime(duration), date: new Date().toISOString(), audioUri: uri, folder: recFolder, speakers, aiSummary: null, hasAudio: true };
      setMeetings([newMeeting, ...meetings]);
      setShowRecord(false); setTitle(''); setDuration(0); setRecording(null); setSpeakers([]); setSpeakerInput('');
    } catch (e) { Alert.alert('Error', 'Could not save recording'); }
  };

  const formatTime = (s) => Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');
  const addSpeaker = () => { const n = speakerInput.trim(); if (n && !speakers.includes(n)) { setSpeakers([...speakers, n]); setSpeakerInput(''); } };
  const removeSpeaker = (n) => setSpeakers(speakers.filter(s => s !== n));

  const exportAsText = (m) => {
    let t = m.title + '\nDuration: ' + m.duration + '\nDate: ' + new Date(m.date).toLocaleDateString() + '\nFolder: ' + m.folder + '\n';
    if (m.speakers?.length) t += 'Speakers: ' + m.speakers.join(', ') + '\n\n';
    if (m.aiSummary) { t += 'SUMMARY:\n' + m.aiSummary.summary + '\n\nKEY POINTS:\n'; m.aiSummary.keyPoints?.forEach(p => t += '• ' + p + '\n'); }
    else t += '\nAI Summary: Add API key in Settings to enable.\n';
    return t;
  };

  const exportAsPDF = async (meeting) => {
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{color:#1a1a1a;font-size:24px}.meta{color:#6b7280;font-size:14px;margin-bottom:24px}.no-ai{background:#fef3c7;color:#92400e;padding:16px;border-radius:8px;margin-bottom:24px}h2{color:#2563eb;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px}p,li{color:#1f2937;line-height:1.6}ul{padding-left:20px}.action{color:#22c55e}.speaker-tag{background:#f59e0b;color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;margin-right:8px}</style></head><body><h1>' + meeting.title + '</h1><div class="meta">' + meeting.duration + ' • ' + meeting.folder + ' • ' + new Date(meeting.date).toLocaleDateString() + '</div>' + (meeting.speakers?.length ? '<div><strong>Speakers:</strong><br>' + meeting.speakers.map(s => '<span class="speaker-tag">' + s + '</span>').join('') + '</div>' : '') + (meeting.aiSummary ? '<h2>Summary</h2><p>' + meeting.aiSummary.summary + '</p><h2>Key Points</h2><ul>' + meeting.aiSummary.keyPoints?.map(p => '<li>' + p + '</li>').join('') + '</ul><h2>Action Items</h2><ul>' + meeting.aiSummary.actionItems?.map(a => '<li class="action">✓ ' + a + '</li>').join('') + '</ul>' : '<div class="no-ai"><strong>AI Summary Not Available</strong><br>Add your OpenAI API key in Settings to enable AI transcription.</div>') + '</body></html>';
    try { const { uri } = await Print.printToFileAsync({ html }); await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Meeting Notes', UTI: 'com.adobe.pdf' }); } catch (e) { Alert.alert('Error', 'Could not export PDF'); }
  };

  const handleProcess = async () => {
    if (!selected) return;
    if (!hasApiKey(apiKey)) { Alert.alert('API Key Required', 'Add your OpenAI API key in Settings.', [{ text: 'Cancel' }, { text: 'Settings', onPress: () => setShowSettings(true) }]); return; }
    if (!selected.hasAudio) { Alert.alert('No Recording', 'Record a new meeting to use AI features.'); return; }
    setProcessing(true);
    try {
      const processed = await processMeeting(selected, apiKey, setProcessingStatus);
      setMeetings(meetings.map(m => m.id === selected.id ? processed : m));
      setSelected(processed);
      Alert.alert('Success', 'AI summary generated!');
    } catch (e) { Alert.alert('Error', 'Processing failed: ' + e.message); }
    finally { setProcessing(false); setProcessingStatus(''); }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}><Text style={styles.cardDuration}>{item.duration}</Text>{item.aiSummary && <Text style={styles.aiTag}>AI</Text>}{!item.aiSummary && item.hasAudio && <Text style={styles.noAiTag}>NO AI</Text>}</View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
      {item.speakers?.length > 0 && <Text style={styles.cardSpeakers}>{item.speakers.join(', ')}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}><Text style={styles.headerTitle}>Meeting Notes AI</Text><TouchableOpacity onPress={() => setShowSettings(true)}><Text style={[styles.settingsBtn, hasApiKey(apiKey) && styles.settingsBtnActive]}>{hasApiKey(apiKey) ? 'API ✓' : 'SETTINGS'}</Text></TouchableOpacity></View>
      <View style={styles.searchBox}><TextInput style={styles.searchInput} placeholder="Search meetings..." value={search} onChangeText={setSearch} /></View>
      <View style={styles.folders}>{FOLDERS.map(f => <TouchableOpacity key={f} style={[styles.folder, folder === f && styles.folderActive]} onPress={() => setFolder(f)}><Text style={[styles.folderText, folder === f && styles.folderTextActive]}>{f}</Text></TouchableOpacity>)}</View>
      <FlatList data={filtered} renderItem={renderItem} keyExtractor={i => i.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>🎙️</Text><Text style={styles.emptyText}>No meetings</Text></View>} />
      <TouchableOpacity style={styles.fab} onPress={() => setShowRecord(true)}><Text style={styles.fabIcon}>+</Text></TouchableOpacity>

      <Modal visible={showRecord} transparent animationType="slide">
        <View style={styles.modalOverlay}><ScrollView><View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>NEW RECORDING</Text><TouchableOpacity onPress={() => { setShowRecord(false); if (timer) clearInterval(timer); }}><Text style={styles.modalClose}>X</Text></TouchableOpacity></View>
          <TextInput style={styles.titleInput} placeholder="Meeting title..." value={title} onChangeText={setTitle} />
          <View style={styles.folderSelect}>{FOLDERS.slice(1).map(f => <TouchableOpacity key={f} style={[styles.chip, recFolder === f && styles.chipActive]} onPress={() => setRecFolder(f)}><Text style={[styles.chipText, recFolder === f && styles.chipTextActive]}>{f}</Text></TouchableOpacity>)}</View>
          <Text style={styles.speakerLabel}>Tag Speakers (optional)</Text>
          <View style={styles.speakerInputRow}><TextInput style={styles.speakerInput} placeholder="Enter name..." value={speakerInput} onChangeText={setSpeakerInput} onSubmitEditing={addSpeaker} /><TouchableOpacity style={styles.addSpeakerBtn} onPress={addSpeaker}><Text style={styles.addSpeakerText}>ADD</Text></TouchableOpacity></View>
          {speakers.length > 0 && <View style={styles.speakerTags}>{speakers.map((s, i) => <TouchableOpacity key={i} style={styles.speakerTag} onPress={() => removeSpeaker(s)}><Text style={styles.speakerTagText}>{s} ×</Text></TouchableOpacity>)}</View>}
          <View style={styles.recArea}><TouchableOpacity style={[styles.recBtn, isRecording && styles.recBtnActive]} onPressIn={startRecording} onPressOut={stopRecording}><View style={[styles.recBtnInner, isRecording && styles.recBtnInnerActive]}><Text style={styles.recIcon}>{isRecording ? 'STOP' : 'REC'}</Text></View></TouchableOpacity><Text style={styles.recTime}>{isRecording ? 'Recording ' + formatTime(duration) : 'Hold to record'}</Text></View>
        </View></ScrollView></View>
      </Modal>

      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>API SETTINGS</Text><TouchableOpacity onPress={() => setShowSettings(false)}><Text style={styles.modalClose}>X</Text></TouchableOpacity></View>
          <Text style={styles.apiLabel}>OpenAI API Key *Required for AI</Text>
          <TextInput style={styles.apiInput} placeholder="sk-..." secureTextEntry value={apiKey} onChangeText={saveApiKey} />
          <Text style={styles.apiHint}>Get key from platform.openai.com/api-keys</Text>
          {!hasApiKey(apiKey) && apiKey.length > 0 && <View style={styles.apiError}><Text style={styles.apiErrorText}>Invalid. Must start with "sk-"</Text></View>}
          {hasApiKey(apiKey) && <View style={styles.apiSuccess}><Text style={styles.apiSuccessText}>✓ API Key configured</Text></View>}
          {!apiKey && <View style={styles.apiRequired}><Text style={styles.apiRequiredText}>AI features require API key. Without it, you can only record and organize meetings.</Text></View>}
          <TouchableOpacity style={styles.saveBtn} onPress={() => setShowSettings(false)}><Text style={styles.saveBtnText}>{hasApiKey(apiKey) ? 'SAVE' : 'CLOSE'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}><Text style={styles.linkBtnText}>Get API Key →</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.detailOverlay}><View style={styles.detail}>
          <View style={styles.detailHeader}><TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.backBtn}>← BACK</Text></TouchableOpacity><View style={styles.detailActions}><TouchableOpacity onPress={() => exportAsPDF(selected)}><Text style={styles.actionBtn}>PDF</Text></TouchableOpacity><TouchableOpacity onPress={() => Share.share({ message: exportAsText(selected) })}><Text style={styles.actionBtn}>SHARE</Text></TouchableOpacity><TouchableOpacity onPress={() => { Clipboard.setString(exportAsText(selected)); Alert.alert('Copied', 'Meeting copied!'); }}><Text style={styles.actionBtn}>COPY</Text></TouchableOpacity><TouchableOpacity onPress={() => { setMeetings(meetings.filter(m => m.id !== selected?.id)); setSelected(null); }}><Text style={[styles.actionBtn, {color: COLORS.error}]}>DEL</Text></TouchableOpacity></View></View>
          <ScrollView style={styles.detailContent}>
            <Text style={styles.detailTitle}>{selected?.title}</Text>
            <Text style={styles.detailMeta}>{selected?.duration} • {selected?.folder} • {new Date(selected?.date).toLocaleDateString()}</Text>
            {selected?.speakers?.length > 0 && <View style={styles.speakersBox}><Text style={styles.speakersLabel}>Speakers</Text><View style={styles.speakersRow}>{selected.speakers.map((s, i) => <Text key={i} style={styles.speakerBadge}>{s}</Text>)}</View></View>}
            {!selected?.aiSummary && (selected?.hasAudio ? <TouchableOpacity style={styles.processBtn} onPress={handleProcess}><Text style={styles.processBtnText}>GENERATE AI SUMMARY</Text></TouchableOpacity> : <View style={styles.noAudioBox}><Text style={styles.noAudioText}>Record a meeting to enable AI transcription.</Text></View>)}
            {processing && <View style={styles.processingBox}><ActivityIndicator size="small" color={COLORS.accent} /><Text style={styles.processingText}>{processingStatus === 'transcribing' ? 'Transcribing...' : processingStatus === 'summarizing' ? 'Generating summary...' : 'Processing...'}</Text></View>}
            {selected?.aiSummary && (<>
              <View style={styles.section}><Text style={styles.sectionTitle}>SUMMARY</Text><Text style={styles.sectionText}>{selected.aiSummary.summary}</Text></View>
              <View style={styles.section}><Text style={styles.sectionTitle}>KEY POINTS</Text>{selected.aiSummary.keyPoints?.map((p, i) => <View key={i} style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>{p}</Text></View>)}</View>
              <View style={styles.section}><Text style={styles.sectionTitle}>ACTION ITEMS</Text>{selected.aiSummary.actionItems?.map((a, i) => <View key={i} style={styles.listItem}><Text style={styles.bulletSuccess}>✓</Text><Text style={styles.listText}>{a}</Text></View>)}</View>
            </>)}
          </ScrollView>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  settingsBtn: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
  settingsBtnActive: { color: COLORS.success },
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
  noAiTag: { fontSize: 10, backgroundColor: COLORS.warning, color: COLORS.card, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  cardDate: { fontSize: 12, color: COLORS.textSecondary },
  cardSpeakers: { fontSize: 11, color: COLORS.warning, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
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
  speakerInputRow: { flexDirection: 'row', marginBottom: 12 },
  speakerInput: { flex: 1, backgroundColor: COLORS.background, padding: 12, borderRadius: 12, fontSize: 14, marginRight: 8 },
  addSpeakerBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  addSpeakerText: { color: COLORS.card, fontWeight: '600', fontSize: 12 },
  speakerTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  speakerTag: { backgroundColor: COLORS.warning, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  speakerTagText: { color: COLORS.card, fontSize: 12 },
  recArea: { alignItems: 'center', paddingVertical: 20 },
  recBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  recBtnActive: { backgroundColor: COLORS.error },
  recBtnInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  recBtnInnerActive: { backgroundColor: COLORS.card },
  recIcon: { fontSize: 14, fontWeight: '700', color: COLORS.card },
  recTime: { fontSize: 14, color: COLORS.textSecondary },
  apiLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  apiInput: { backgroundColor: COLORS.background, padding: 14, borderRadius: 12, fontSize: 14 },
  apiHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
  apiError: { marginTop: 16, padding: 12, backgroundColor: '#fee2e2', borderRadius: 8 },
  apiErrorText: { fontSize: 14, color: COLORS.error },
  apiSuccess: { marginTop: 16, padding: 12, backgroundColor: '#dcfce7', borderRadius: 8 },
  apiSuccessText: { fontSize: 14, color: COLORS.success },
  apiRequired: { marginTop: 16, padding: 16, backgroundColor: '#fef3c7', borderRadius: 8 },
  apiRequiredText: { fontSize: 13, color: '#92400e', lineHeight: 20 },
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
  noAudioBox: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, marginBottom: 24 },
  noAudioText: { fontSize: 13, color: '#92400e', lineHeight: 20 },
  processingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 24, gap: 12 },
  processingText: { fontSize: 14, color: COLORS.textSecondary },
  section: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.accent, letterSpacing: 1, marginBottom: 12 },
  sectionText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  listItem: { flexDirection: 'row', marginBottom: 8 },
  bullet: { fontSize: 14, marginRight: 8, color: COLORS.accent },
  bulletSuccess: { fontSize: 14, marginRight: 8, color: COLORS.success },
  listText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 22 },
});
