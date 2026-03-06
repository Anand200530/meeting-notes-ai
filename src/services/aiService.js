/**
 * AI Service - Multiple STT Options
 * 1. OpenAI Whisper (for buyers - paid)
 * 2. AssemblyAI (free tier available)
 * 3. Web Speech API (free - browser based)
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function hasApiKey(apiKey) {
  return apiKey && apiKey.startsWith('sk-');
}

// ============================================
// OPTION 1: OpenAI Whisper (For buyers)
// ============================================
export async function transcribeWithWhisper(audioUri, apiKey) {
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
  
  if (!result.ok) throw new Error('Whisper transcription failed');
  return await result.text();
}

// ============================================
// OPTION 2: AssemblyAI (Free tier)
// ============================================
export async function transcribeWithAssemblyAI(audioUri, apiKey) {
  // Upload audio
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { 'Authorization': apiKey },
    body: audioUri
  });
  const { upload_url } = await uploadResponse.json();
  
  // Start transcription
  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url })
  });
  const { id } = await transcriptResponse.json();
  
  // Poll for result
  while (true) {
    await new Promise(r => setTimeout(r, 1000));
    const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { 'Authorization': apiKey }
    });
    const result = await statusResponse.json();
    if (result.status === 'completed') return result.text;
    if (result.status === 'error') throw new Error('AssemblyAI failed');
  }
}

// ============================================
// OPTION 3: Web Speech API (Free - for testing)
// Note: This works in browser/React Native Web
// ============================================

// ============================================
// GPT Summary Generation
// ============================================
export async function generateSummary(transcript, apiKey) {
  const prompt = `Analyze this meeting transcript and provide JSON with summary, keyPoints, actionItems, questions.

Transcript:
${transcript.substring(0, 6000)}`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a meeting notes analyzer. Return valid JSON.' },
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

// ============================================
// Main Process - Uses Whisper by default (for buyers)
// ============================================
export async function processMeeting(meeting, apiKey, onProgress = () => {}) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  // Transcribe with Whisper
  onProgress('transcribing');
  const transcript = await transcribeWithWhisper(meeting.audioUri, apiKey);
  
  // Generate summary with GPT
  onProgress('summarizing');
  const aiSummary = await generateSummary(transcript, apiKey);
  
  return { ...meeting, transcript, aiSummary };
}

export default { 
  hasApiKey, 
  transcribeWithWhisper, 
  transcribeWithAssemblyAI,
  generateSummary, 
  processMeeting 
};
