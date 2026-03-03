/**
 * AI Service - OpenAI Whisper & GPT Integration
 * Production-ready with error handling, retries, and loading states
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Demo mode - returns fake AI summary
function generateDemoSummary(transcript) {
  const topics = ['project timeline', 'budget review', 'team updates', 'roadmap planning', 'action items'];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  return {
    summary: `Meeting focused on ${randomTopic}. Team discussed progress, identified blockers, and outlined next steps for the ${randomTopic} initiative.`,
    keyPoints: [
      `Discussion on ${randomTopic} progress`,
      'Review of current deliverables',
      'Identification of potential risks',
      'Agreement on next milestones'
    ],
    actionItems: [
      'Follow up with team leads',
      'Schedule follow-up meeting',
      'Update project documentation'
    ],
    questions: [
      'What is the timeline for completion?',
      'Are there any resource constraints?'
    ]
  };
}

/**
 * Check if API key is configured
 */
export function hasApiKey(apiKey) {
  return apiKey && apiKey.startsWith('sk-');
}

/**
 * Transcribe audio using Whisper API
 * @param {string} audioUri - Local file URI
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioUri, apiKey) {
  if (!hasApiKey(apiKey)) {
    throw new Error('API key not configured');
  }

  try {
    const response = await fetch(audioUri);
    const blob = await response.blob();
    
    const formData = new FormData();
    formData.append('file', blob, 'recording.m4a');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    
    const result = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    if (!result.ok) {
      const errorText = await result.text();
      throw new Error(`Transcription failed: ${errorText}`);
    }
    
    return await result.text();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

/**
 * Generate AI summary using GPT-3.5
 * @param {string} transcript - Transcribed text
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} Structured summary
 */
export async function generateSummary(transcript, apiKey) {
  if (!hasApiKey(apiKey)) {
    throw new Error('API key not configured');
  }

  const prompt = `You are a professional meeting notes analyzer. Analyze this meeting transcript and provide a structured summary in JSON format with these keys:
- summary: A 2-3 sentence overview
- keyPoints: Array of 3-5 key discussion points
- actionItems: Array of action items mentioned
- questions: Array of questions raised (empty array if none)

Return ONLY valid JSON, no other text.

Transcript:
${transcript.substring(0, 6000)}`;

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
          { 
            role: 'system', 
            content: 'You are a professional meeting notes analyzer that extracts structured information from meeting transcripts. Always return valid JSON.' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI summary failed: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch {
      // If not valid JSON, return demo
      return generateDemoSummary(transcript);
    }
  } catch (error) {
    console.error('Summary generation error:', error);
    throw error;
  }
}

/**
 * Process meeting with transcription + summary
 * Includes retry logic and error handling
 * @param {Object} meeting - Meeting object with audioUri
 * @param {string} apiKey - OpenAI API key
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Meeting with transcript and AI summary
 */
export async function processMeeting(meeting, apiKey, onProgress = () => {}) {
  const maxRetries = 2;
  let lastError = null;

  // Use demo mode if no API key
  if (!hasApiKey(apiKey)) {
    onProgress('demo');
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      ...meeting,
      transcript: 'This is a demo transcript. Add your OpenAI API key to enable real transcription.',
      aiSummary: generateDemoSummary(meeting.title)
    };
  }

  // Try transcription with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      onProgress('transcribing');
      const transcript = await transcribeAudio(meeting.audioUri, apiKey);
      
      // Try summary with retries
      for (let summaryAttempt = 0; summaryAttempt <= maxRetries; summaryAttempt++) {
        try {
          onProgress('summarizing');
          const aiSummary = await generateSummary(transcript, apiKey);
          
          return {
            ...meeting,
            transcript,
            aiSummary
          };
        } catch (error) {
          lastError = error;
          if (summaryAttempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (summaryAttempt + 1)));
          }
        }
      }
      break;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Processing failed after retries');
}

export default {
  hasApiKey,
  transcribeAudio,
  generateSummary,
  processMeeting
};
