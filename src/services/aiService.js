/**
 * AI Service - OpenAI Whisper & GPT Integration
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * Transcribe audio using Whisper API
 */
export async function transcribeAudio(audioUri, apiKey) {
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
    
    if (!result.ok) throw new Error('Transcription failed');
    return await result.text();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

/**
 * Generate AI summary using GPT
 */
export async function generateSummary(transcript, apiKey) {
  const prompt = `Analyze this meeting transcript and provide:
1. Summary (2-3 sentences)
2. Key Points (3-5 items)
3. Action Items
4. Questions Raised

Return as JSON with keys: summary, keyPoints, actionItems, questions

Transcript: ${transcript.substring(0, 4000)}`;

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
          { role: 'system', content: 'You are a meeting notes analyzer.' },
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
 * Process meeting with transcription + summary
 */
export async function processMeeting(meeting, apiKey) {
  const transcript = await transcribeAudio(meeting.audioUri, apiKey);
  const aiSummary = await generateSummary(transcript, apiKey);
  return { ...meeting, transcript, aiSummary };
}
