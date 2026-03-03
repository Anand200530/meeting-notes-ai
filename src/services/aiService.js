/**
 * AI Service - Whisper + GPT
 * Audio transcription + AI summary generation
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function hasApiKey(apiKey) {
  return apiKey && apiKey.startsWith('sk-');
}

/**
 * Transcribe audio using Whisper API
 */
export async function transcribeAudio(audioUri, apiKey) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  try {
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
    
    if (!result.ok) {
      throw new Error('Transcription failed');
    }
    
    return await result.text();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

/**
 * Generate AI summary using GPT from transcript
 */
export async function generateSummary(transcript, apiKey) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  const prompt = `You are a professional meeting notes analyzer. Analyze this meeting transcript and provide a detailed JSON summary.

Transcript:
${transcript.substring(0, 6000)}

Provide JSON with:
{
  "summary": "2-3 sentence overview",
  "keyPoints": ["3-5 important points"],
  "actionItems": ["action items or next steps"],
  "questions": ["questions raised"]
}`;

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a professional meeting notes analyzer. Return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) throw new Error('AI summary failed');
    
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Summary error:', error);
    throw error;
  }
}

/**
 * Process meeting: Transcribe audio → Generate summary
 */
export async function processMeeting(meeting, apiKey, onProgress = () => {}) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  // Step 1: Transcribe audio with Whisper
  onProgress('transcribing');
  const transcript = await transcribeAudio(meeting.audioUri, apiKey);
  
  // Step 2: Generate summary with GPT
  onProgress('summarizing');
  const aiSummary = await generateSummary(transcript, apiKey);
  
  return { 
    ...meeting, 
    transcript,
    aiSummary 
  };
}

export default { hasApiKey, transcribeAudio, generateSummary, processMeeting };
