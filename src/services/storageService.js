/**
 * Storage Service - Local Data Persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MEETINGS_KEY = '@meetings';
const SETTINGS_KEY = '@settings';

export async function getMeetings() {
  try {
    const data = await AsyncStorage.getItem(MEETINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export async function saveMeetings(meetings) {
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

export async function addMeeting(meeting) {
  const meetings = await getMeetings();
  meetings.unshift(meeting);
  await saveMeetings(meetings);
}

export async function deleteMeeting(id) {
  const meetings = await getMeetings();
  await saveMeetings(meetings.filter(m => m.id !== id));
}

export async function getSettings() {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { openai: '', whisper: '' };
  } catch { return { openai: '', whisper: '' }; }
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function exportAsText(meeting) {
  let text = `${meeting.title}\nDuration: ${meeting.duration}\nDate: ${new Date(meeting.date).toLocaleDateString()}\n\n`;
  if (meeting.aiSummary) {
    text += `SUMMARY:\n${meeting.aiSummary.summary}\n\nKEY POINTS:\n`;
    meeting.aiSummary.keyPoints?.forEach(p => text += `• ${p}\n`);
    text += `\nACTION ITEMS:\n`;
    meeting.aiSummary.actionItems?.forEach(a => text += `✓ ${a}\n`);
  }
  return text;
}
