/**
 * AI Service - GPT Only (No Whisper)
 * Generate summaries directly using GPT
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function hasApiKey(apiKey) {
  return apiKey && apiKey.startsWith('sk-');
}

/**
 * Generate AI summary using GPT
 * No transcription needed - generates summary from meeting info
 */
export async function generateSummary(meeting, apiKey) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  const prompt = `You are a professional meeting notes generator. Generate a detailed summary for this meeting.

Meeting Details:
- Title: ${meeting.title}
- Duration: ${meeting.duration}
- Folder: ${meeting.folder}
- Speakers: ${meeting.speakers?.join(', ') || 'Not specified'}
- Date: ${new Date(meeting.date).toLocaleDateString()}

Generate a JSON response with:
{
  "summary": "2-3 sentence overview of the meeting",
  "keyPoints": ["3-5 important points discussed"],
  "actionItems": ["action items or next steps mentioned"],
  "questions": ["questions raised during the meeting"]
}

Be realistic and generate plausible meeting content based on the title and folder context.`;

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
          { role: 'system', content: 'You are a professional meeting notes analyzer that generates detailed summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI failed: ${error}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Summary error:', error);
    throw error;
  }
}

/**
 * Process meeting - Generate AI summary using GPT only
 */
export async function processMeeting(meeting, apiKey, onProgress = () => {}) {
  if (!hasApiKey(apiKey)) throw new Error('API key required');
  
  onProgress('generating');
  
  // Generate summary directly with GPT (no transcription)
  const aiSummary = await generateSummary(meeting, apiKey);
  
  return { 
    ...meeting, 
    aiSummary,
    transcript: 'Summary generated via GPT (transcription not enabled)' 
  };
}

export default { hasApiKey, generateSummary, processMeeting };
