export const maxDuration = 30;

// Strip markdown and image tags before TTS
function cleanForSpeech(text: string): string {
  return text
    .replace(/\[Image:\s*[^\]]+\]/gi, '') // [Image: ID]
    .replace(/!\[.*?\]\(.*?\)/g, '')       // markdown images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // markdown links → label
    .replace(/#{1,6}\s+/g, '')             // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')           // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // code
    .replace(/[-*+]\s+/g, '')             // list bullets
    .replace(/\n{2,}/g, '. ')             // double newlines → pause
    .replace(/\n/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response('ElevenLabs API key not configured', { status: 503 });
  }

  const { text } = await req.json() as { text?: string };
  if (!text?.trim()) {
    return new Response('No text provided', { status: 400 });
  }

  const cleaned = cleanForSpeech(text).slice(0, 5000); // ElevenLabs limit

  // Rachel voice — clear, professional
  const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: cleaned,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('[tts] ElevenLabs error:', err);
    return new Response('TTS service error', { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
