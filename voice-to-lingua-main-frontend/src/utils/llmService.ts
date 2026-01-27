// src/utils/llmService.ts
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// ⚠️ WARNING: In a production app, calling LLMs from the frontend exposes your API Key.
// For a hackathon or local prototype, this is fine. For production, move this to 'whisper-backend'.

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("Missing VITE_GROQ_API_KEY in .env file");
}

// 1. Initialize the Model
const llm = new ChatGroq({
  apiKey: GROQ_API_KEY,
  model: "llama-3.3-70b-versatile", // High performance model
  temperature: 0.1,
});

// 2. Define output type
export interface TranslationResult {
  original: string;
  translatedScript: string;
  phoneticHinglish: string;
}

/**
 * Two-step translation: English -> Target Script -> Phonetic Hinglish
 */
export async function generateAudioFriendlyTranslation(
  text: string, 
  targetLang: string = "Hindi"
): Promise<TranslationResult> {
  console.log(`[LLM] Processing: "${text}" -> ${targetLang}`);

  try {
    // --- Step A: Translate to Target Script ---
    const translationResponse = await llm.invoke([
      new SystemMessage(
        `You are an expert translator. Translate the user's text to ${targetLang}. 
         Output ONLY the translated text in the native script of ${targetLang}. 
         Do not add explanations.`
      ),
      new HumanMessage(text),
    ]);

    const translatedText = translationResponse.content.toString().trim();

    // --- Step B: Convert to "Google TTS" Hinglish ---
    const phoneticResponse = await llm.invoke([
      new SystemMessage(
        `You are a phonetic expert for Text-to-Speech engines.
         Convert the following ${targetLang} text into a Latin/Romanized phonetic version (Hinglish) 
         that ensures Google Translate's English TTS engine pronounces it correctly.
         
         Rules:
         1. Use simple phonetic spelling.
         2. Output ONLY the phonetic text.
         3. Do not add markdown or punctuation that isn't in the speech.`
      ),
      new HumanMessage(translatedText),
    ]);

    const phoneticText = phoneticResponse.content.toString().trim();

    return {
      original: text,
      translatedScript: translatedText,
      phoneticHinglish: phoneticText
    };

  } catch (error) {
    console.error("LLM Translation Failed:", error);
    // Return safe fallback or rethrow
    throw error;
  }
}