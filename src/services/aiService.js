/**
 * AI Service - OpenAI Whisper & GPT Integration
 * Requires valid API key - no demo mode
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function hasApiKey(apiKey) {
  return apiKey && apiKey.startsWith('sk-');
}

export async function transcribeAudio(audioUri, apiKey) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  const response = await fetch(audioUri);
  const blob = await response.blob();
  
  const formData = new FormData();
  formData.append('file', blob, 'recording.m4a');
  formData.append('model', 'whisper-1');
  
  const result = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });
  
  if (!result.ok) throw new Error('Transcription failed');
  return await result.text();
}

export async function generateSummary(transcript, apiKey) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  const prompt = `Provide JSON with: summary, keyPoints, actionItems, questions. Transcript: ${transcript.substring(0, 6000)}`;
  
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Meeting notes analyzer. Return valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) throw new Error('AI summary failed');
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function processMeeting(meeting, apiKey, onProgress = () => {}) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  onProgress('transcribing');
  const transcript = await transcribeAudio(meeting.audioUri, apiKey);
  
  onProgress('summarizing');
  const aiSummary = await generateSummary(transcript, apiKey);
  
  return { ...meeting, transcript, aiSummary };
}

export default { hasApiKey, transcribeAudio, generateSummary, processMeeting };
