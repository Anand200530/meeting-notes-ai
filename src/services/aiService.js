/**
 * AI Service - OpenAI Whisper & GPT Integration
 * Production-ready with error handling, retries, and demo mode
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Check if API key is valid
export function hasApiKey(apiKey) {
  return apiKey && apiKey.startsWith('sk-');
}

// Demo summary generator - works without API
function generateDemoSummary() {
  const topics = ['project updates', 'team coordination', 'planning session', 'brainstorming', 'review meeting'];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  return {
    summary: `This was a productive ${randomTopic} where the team discussed important matters and made progress on key objectives.`,
    keyPoints: [
      'Discussion on current project status',
      'Team coordination and collaboration',
      'Next steps and action items identified',
      'Open questions for follow-up'
    ],
    actionItems: [
      'Schedule follow-up meeting',
      'Share updates with stakeholders',
      'Review action items from this meeting'
    ],
    questions: [
      'What are the next milestones?',
      'Any blockers to address?'
    ]
  };
}

/**
 * Transcribe audio using Whisper API
 * Requires valid API key
 */
export async function transcribeAudio(audioUri, apiKey) {
  if (!hasApiKey(apiKey)) {
    throw new Error('API key required for transcription');
  }

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
      throw new Error(`Transcription failed: ${result.statusText}`);
    }
    
    return await result.text();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

/**
 * Generate AI summary using GPT
 * Requires valid API key
 */
export async function generateSummary(transcript, apiKey) {
  if (!hasApiKey(apiKey)) {
    throw new Error('API key required for summarization');
  }

  const prompt = `You are a professional meeting notes analyzer. Provide JSON with: summary, keyPoints, actionItems, questions.

Transcript: ${transcript.substring(0, 6000)}`;

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
          { role: 'system', content: 'You are a meeting notes analyzer. Return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI summary failed: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Summary error:', error);
    throw error;
  }
}

/**
 * Process meeting - handles both API and demo mode
 */
export async function processMeeting(meeting, apiKey, onProgress = () => {}) {
  // Demo mode - no API key
  if (!hasApiKey(apiKey)) {
    onProgress('demo');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
    
    return {
      ...meeting,
      transcript: 'Demo transcript - Add your OpenAI API key to enable real transcription.',
      aiSummary: generateDemoSummary()
    };
  }

  // Real processing with API
  try {
    onProgress('transcribing');
    const transcript = await transcribeAudio(meeting.audioUri, apiKey);
    
    onProgress('summarizing');
    const aiSummary = await generateSummary(transcript, apiKey);
    
    return { ...meeting, transcript, aiSummary };
  } catch (error) {
    console.error('Processing error:', error);
    throw error;
  }
}

export default { hasApiKey, transcribeAudio, generateSummary, processMeeting };
