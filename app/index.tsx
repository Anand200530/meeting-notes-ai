import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Modal, Alert, ActivityIndicator, ScrollView, Share, SafeAreaView, StatusBar, Keyboard, TouchableWithoutFeedback, Platform, KeyboardAvoidingView } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const DEMO_MEETINGS = [
  { id: '1', title: 'Weekly Team Standup', duration: '15:32', date: new Date().toISOString(), speakers: [], aiSummary: null, folder: 'Work', hasAudio: false, audioUri: '', transcript: '' },
  { id: '2', title: 'Product Review', duration: '28:15', date: new Date(Date.now() - 86400000).toISOString(), speakers: [], aiSummary: null, folder: 'Product', hasAudio: false, audioUri: '', transcript: '' },
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
  const [assemblyKey, setAssemblyKey] = useState('');
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
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => { loadSettings(); }, []);
  
  const loadSettings = async () => { 
    try { 
      const settings = await AsyncStorage.getItem('@settings'); 
      if (settings) {
        const p = JSON.parse(settings);
        setApiKey(p.openai || '');
        setAssemblyKey(p.assemblyai || '');
      }
    } catch {} 
  };
  
  const saveSettings = async () => {
    try { await AsyncStorage.setItem('@settings', JSON.stringify({ openai: apiKey, assemblyai: assemblyKey })); } catch {}
  };

  const filtered = meetings.filter(m => (folder === 'All' || m.folder === folder) && m.title.toLowerCase().includes(search.toLowerCase()));

  const closeModals = () => {
    setShowRecord(false); setShowSettings(false);
    if (timer) clearInterval(timer); setIsRecording(false); Keyboard.dismiss();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (timer) clearInterval(timer); setIsRecording(false);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const newMeeting = { id: Date.now().toString(), title: title || 'Meeting ' + (meetings.length + 1), duration: formatTime(duration), date: new Date().toISOString(), audioUri: uri, folder: recFolder, speakers, aiSummary: null, hasAudio: true, transcript: '' };
        setMeetings([newMeeting, ...meetings]);
        Alert.alert('Recording Saved!');
        closeModals();
        setTitle(''); setDuration(0); setRecording(null); setSpeakers([]); setSpeakerInput('');
      } catch (e) { Alert.alert('Error', 'Could not save recording'); }
    } else {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Required', 'Please grant microphone permission.'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording); setIsRecording(true); setDuration(0);
        setTimer(setInterval(() => setDuration(d => d + 1), 1000));
      } catch (e) { Alert.alert('Error', 'Could not start recording: ' + e.message); }
    }
  };

  const playAudio = async (uri) => {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); }
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setIsPlaying(true);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) { setIsPlaying(false); }
      });
    } catch (e) { Alert.alert('Error', 'Could not play audio: ' + e.message); }
  };

  const stopAudio = async () => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); setIsPlaying(false); }
    } catch (e) {}
  };

  const formatTime = (s) => Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');
  const addSpeaker = () => { const n = speakerInput.trim(); if (n && !speakers.includes(n)) { setSpeakers([...speakers, n]); setSpeakerInput(''); } };
  const removeSpeaker = (n) => setSpeakers(speakers.filter(s => s !== n));

  // Transcribe with AssemblyAI
  const transcribeAudio = async (audioUri) => {
    if (!assemblyKey) throw new Error('Add AssemblyAI key in Settings first');
    
    try {
      // Upload audio
      const response = await fetch(audioUri);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: { 'Authorization': assemblyKey },
        body: base64
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadData.upload_url) throw new Error('Upload failed');
      
      // Start transcription
      const transRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { 'Authorization': assemblyKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: uploadData.upload_url })
      });
      const transData = await transRes.json();
      
      if (!transData.id) throw new Error('Transcription request failed');
      
      // Poll for result
      let result;
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const checkRes = await fetch('https://api.assemblyai.com/v2/transcript/' + transData.id, {
          headers: { 'Authorization': assemblyKey }
        });
        result = await checkRes.json();
        if (result.status === 'completed') break;
        if (result.status === 'error') throw new Error('Transcription failed');
      }
      
      return result.text;
    } catch (e) {
      throw new Error('Transcription error: ' + e.message);
    }
  };

  // Generate summary with GPT
  const generateSummary = async (transcript, meetingTitle) => {
    if (!apiKey) throw new Error('Add OpenAI key in Settings first');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ 
        model: 'gpt-3.5-turbo', 
        messages: [
          { role: 'system', content: 'You are a meeting notes analyzer. Return valid JSON with summary, keyPoints, actionItems.' },
          { role: 'user', content: 'Analyze this transcript and provide JSON:\n' + transcript.substring(0, 6000) }
        ], 
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });
    if (!response.ok) throw new Error('GPT failed');
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  };

  const handleTranscribe = async () => {
    if (!selected || !selected.hasAudio) {
      Alert.alert('No Recording', 'Record a meeting first');
      return;
    }
    
    if (!assemblyKey) {
      Alert.alert('API Key Required', 'Add AssemblyAI key in Settings to transcribe');
      return;
    }
    
    setProcessing(true);
    try {
      Alert.alert('Transcribing...', 'This may take a minute');
      const transcript = await transcribeAudio(selected.audioUri);
      const updated = { ...selected, transcript };
      setMeetings(meetings.map(m => m.id === selected.id ? updated : m));
      setSelected(updated);
      Alert.alert('Done', 'Transcription complete!');
    } catch (e) { 
      Alert.alert('Error', e.message); 
    }
    setProcessing(false);
  };

  const handleSummarize = async () => {
    if (!selected || !selected.transcript) {
      Alert.alert('No Transcript', 'Transcribe first');
      return;
    }
    
    if (!apiKey) {
      Alert.alert('API Key Required', 'Add OpenAI key in Settings to summarize');
      return;
    }
    
    setProcessing(true);
    try {
      Alert.alert('Summarizing...', 'This may take a moment');
      const aiSummary = await generateSummary(selected.transcript, selected.title);
      const updated = { ...selected, aiSummary };
      setMeetings(meetings.map(m => m.id === selected.id ? updated : m));
      setSelected(updated);
      Alert.alert('Done', 'Summary generated!');
    } catch (e) { 
      Alert.alert('Error', e.message); 
    }
    setProcessing(false);
  };

  const exportAsText = (m) => {
    let t = m.title + '\nDuration: ' + m.duration + '\nDate: ' + new Date(m.date).toLocaleDateString() + '\nFolder: ' + m.folder + '\n';
    if (m.transcript) { t += '\nTRANSCRIPT:\n' + m.transcript + '\n'; }
    if (m.aiSummary) { t += '\nSUMMARY:\n' + m.aiSummary.summary + '\n\nKEY POINTS:\n'; m.aiSummary.keyPoints.forEach(p => t += '- ' + p + '\n'); }
    return t;
  };

  const exportAsPDF = async (meeting) => {
    const html = '<!DOCTYPE html><html><head><style>body{font-family:-apple-system;padding:40px}h1{color:#1a1a1a}p,li{color:#1f2937;line-height:1.6}ul{padding-left:20px}</style></head><body><h1>' + meeting.title + '</h1><p>' + meeting.duration + ' - ' + meeting.folder + '</p>' + (meeting.transcript ? '<h2>Transcript</h2><p>' + meeting.transcript + '</p>' : '') + (meeting.aiSummary ? '<h2>Summary</h2><p>' + meeting.aiSummary.summary + '</p><h2>Key Points</h2><ul>' + meeting.aiSummary.keyPoints.map(p => '<li>' + p + '</li>').join('') + '</ul>' : '<p>No summary.</p>') + '</body></html>';
    try { const { uri } = await Print.printToFileAsync({ html }); await Sharing.shareAsync(uri, { mimeType: 'application/pdf' }); } catch (e) { Alert.alert('Error', 'Could not export'); }
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDuration}>{item.duration}</Text>
          {item.aiSummary ? <Text style={styles.aiTag}>AI</Text> : item.transcript ? <Text style={styles.transcriptTag}>TEXT</Text> : null}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
        {item.hasAudio ? <Text style={styles.audioTag}>Audio saved</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meeting Notes AI</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsBtn}>SETTINGS</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchBox}>
        <TextInput style={styles.searchInput} placeholder="Search..." value={search} onChangeText={setSearch} />
      </View>
      <View style={styles.folders}>
        {FOLDERS.map(f => (
          <TouchableOpacity key={f} style={[styles.folder, folder === f && styles.folderActive]} onPress={() => setFolder(f)}>
            <Text style={[styles.folderText, folder === f && styles.folderTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={filtered} renderItem={renderItem} keyExtractor={i => i.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No meetings</Text></View>} />
      <TouchableOpacity style={styles.fab} onPress={() => setShowRecord(true)}><Text style={styles.fabIcon}>+</Text></TouchableOpacity>

      <Modal visible={showRecord} transparent animationType="slide" onRequestClose={closeModals}>
        <TouchableWithoutFeedback onPress={closeModals}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>NEW RECORDING</Text>
                  <TouchableOpacity onPress={closeModals}><Text style={styles.modalClose}>X</Text></TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <TextInput style={styles.titleInput} placeholder="Meeting title..." value={title} onChangeText={setTitle} />
                  <View style={styles.folderSelect}>
                    {FOLDERS.slice(1).map(f => (
                      <TouchableOpacity key={f} style={[styles.chip, recFolder === f && styles.chipActive]} onPress={() => setRecFolder(f)}>
                        <Text style={[styles.chipText, recFolder === f && styles.chipTextActive]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.speakerInputRow}>
                    <TextInput style={styles.speakerInput} placeholder="Speaker name..." value={speakerInput} onChangeText={setSpeakerInput} onSubmitEditing={addSpeaker} />
                    <TouchableOpacity style={styles.addSpeakerBtn} onPress={addSpeaker}><Text style={styles.addSpeakerText}>ADD</Text></TouchableOpacity>
                  </View>
                  {speakers.length > 0 ? <View style={styles.speakerTags}>{speakers.map((s, i) => <TouchableOpacity key={i} style={styles.speakerTag} onPress={() => removeSpeaker(s)}><Text style={styles.speakerTagText}>{s} x</Text></TouchableOpacity>)}</View> : null}
                  <View style={styles.recArea}>
                    <TouchableOpacity style={[styles.recBtn, isRecording && styles.recBtnActive]} onPress={toggleRecording}>
                      <View style={[styles.recBtnInner, isRecording && styles.recBtnInnerActive]}><Text style={styles.recIcon}>{isRecording ? 'STOP' : 'START'}</Text></View>
                    </TouchableOpacity>
                    <Text style={styles.recTime}>{isRecording ? 'Recording ' + formatTime(duration) : 'Tap to start'}</Text>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={closeModals}>
        <TouchableWithoutFeedback onPress={closeModals}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>SETTINGS</Text>
                  <TouchableOpacity onPress={closeModals}><Text style={styles.modalClose}>X</Text></TouchableOpacity>
                </View>
                <ScrollView>
                  <Text style={styles.apiLabel}>AssemblyAI API Key (Free Transcription)</Text>
                  <TextInput style={styles.apiInput} placeholder="Enter your AssemblyAI key..." value={assemblyKey} onChangeText={setAssemblyKey} />
                  <Text style={styles.apiHint}>Get free key at assemblyai.com</Text>
                  
                  <Text style={styles.apiLabel}>OpenAI API Key (Summary)</Text>
                  <TextInput style={styles.apiInput} placeholder="sk-..." secureTextEntry value={apiKey} onChangeText={setApiKey} />
                  <Text style={styles.apiHint}>For GPT summarization</Text>
                  
                  <TouchableOpacity style={styles.saveBtn} onPress={() => { saveSettings(); closeModals(); }}><Text style={styles.saveBtnText}>SAVE</Text></TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={selected ? true : false} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detail}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.backBtn}>BACK</Text></TouchableOpacity>
              <View style={styles.detailActions}>
                <TouchableOpacity onPress={() => exportAsPDF(selected)}><Text style={styles.actionBtn}>PDF</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => Share.share({ message: exportAsText(selected) })}><Text style={styles.actionBtn}>SHARE</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setMeetings(meetings.filter(m => m.id !== selected.id)); setSelected(null); }}><Text style={[styles.actionBtn, {color: COLORS.error}]}>DEL</Text></TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.detailContent}>
              <Text style={styles.detailTitle}>{selected ? selected.title : ''}</Text>
              <Text style={styles.detailMeta}>{selected ? selected.duration : ''} - {selected ? selected.folder : ''}</Text>
              
              {selected && selected.hasAudio && !selected.transcript ? (
                <View style={styles.playBox}>
                  <Text style={styles.playTitle}>Test Recording</Text>
                  <TouchableOpacity style={styles.playBtn} onPress={() => isPlaying ? stopAudio() : playAudio(selected.audioUri)}>
                    <Text style={styles.playBtnText}>{isPlaying ? 'STOP' : 'PLAY'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              
              {selected && selected.hasAudio && !selected.transcript ? (
                <TouchableOpacity style={styles.transcribeBtn} onPress={handleTranscribe} disabled={processing}>
                  <Text style={styles.transcribeBtnText}>{processing ? 'Transcribing...' : 'TRANSCRIBE'}</Text>
                </TouchableOpacity>
              ) : null}
              
              {selected && selected.transcript ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>TRANSCRIPT</Text>
                  <Text style={styles.transcriptText}>{selected.transcript}</Text>
                </View>
              ) : null}
              
              {selected && selected.transcript && !selected.aiSummary ? (
                <TouchableOpacity style={styles.processBtn} onPress={handleSummarize} disabled={processing}>
                  <Text style={styles.processBtnText}>{processing ? 'Summarizing...' : 'SUMMARIZE'}</Text>
                </TouchableOpacity>
              ) : null}
              
              {selected && selected.aiSummary ? (
                <>
                  <View style={styles.section}><Text style={styles.sectionTitle}>SUMMARY</Text><Text>{selected.aiSummary.summary}</Text></View>
                  <View style={styles.section}><Text style={styles.sectionTitle}>KEY POINTS</Text>{selected.aiSummary.keyPoints.map((p, i) => <Text key={i} style={styles.listItem}>- {p}</Text>)}</View>
                </>
              ) : null}
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
  card: { width: '48%', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDuration: { fontSize: 12, color: COLORS.textSecondary },
  aiTag: { fontSize: 10, backgroundColor: COLORS.accent, color: COLORS.card, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '600' },
  transcriptTag: { fontSize: 10, backgroundColor: COLORS.success, color: COLORS.card, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  cardDate: { fontSize: 12, color: COLORS.textSecondary },
  audioTag: { fontSize: 10, color: COLORS.warning, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  fabIcon: { fontSize: 28, color: COLORS.card },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  modalClose: { fontSize: 20, color: COLORS.textSecondary },
  titleInput: { backgroundColor: COLORS.background, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  folderSelect: { flexDirection: 'row', marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: COLORS.background, marginRight: 8 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.card },
  speakerInputRow: { flexDirection: 'row', marginBottom: 12 },
  speakerInput: { flex: 1, backgroundColor: COLORS.background, padding: 12, borderRadius: 12, fontSize: 14, marginRight: 8 },
  addSpeakerBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  addSpeakerText: { color: COLORS.card, fontWeight: '600', fontSize: 12 },
  speakerTags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  speakerTag: { backgroundColor: COLORS.warning, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  speakerTagText: { color: COLORS.card, fontSize: 12 },
  recArea: { alignItems: 'center', paddingVertical: 20 },
  recBtn: { width: 140, height: 140, borderRadius: 70, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  recBtnActive: { backgroundColor: COLORS.error },
  recBtnInner: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  recBtnInnerActive: { backgroundColor: COLORS.card },
  recIcon: { fontSize: 16, fontWeight: '700', color: COLORS.card },
  recTime: { fontSize: 14, color: COLORS.textSecondary },
  apiLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  apiInput: { backgroundColor: COLORS.background, padding: 14, borderRadius: 12, fontSize: 14 },
  apiHint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, marginBottom: 8 },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: COLORS.card, fontWeight: '700' },
  detailOverlay: { flex: 1, backgroundColor: COLORS.background },
  detail: { flex: 1, backgroundColor: COLORS.background },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },
  detailActions: { flexDirection: 'row' },
  actionBtn: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginLeft: 16 },
  detailContent: { flex: 1, padding: 20 },
  detailTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  detailMeta: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  playBox: { backgroundColor: '#dbeafe', padding: 20, borderRadius: 16, marginBottom: 20, alignItems: 'center' },
  playTitle: { fontSize: 16, fontWeight: '600', color: '#1e40af', marginBottom: 12 },
  playBtn: { backgroundColor: '#2563eb', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  playBtnText: { color: COLORS.card, fontWeight: '700', fontSize: 16 },
  transcribeBtn: { backgroundColor: COLORS.success, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  transcribeBtnText: { color: COLORS.card, fontWeight: '700' },
  processBtn: { backgroundColor: COLORS.accent, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  processBtnText: { color: COLORS.card, fontWeight: '700' },
  section: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.accent, letterSpacing: 1, marginBottom: 12 },
  transcriptText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  listItem: { fontSize: 14, marginBottom: 8 },
});
