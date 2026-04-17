// src/utils/llmService.ts
import 'react-native-get-random-values'; // Polyfill for LangChain
import 'text-encoding-polyfill';         // Polyfill for LangChain
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// 1. Setup API Key for Expo
// In Expo, use variables starting with EXPO_PUBLIC_ to make them visible
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || "gsk_YOUR_ACTUAL_API_KEY_HERE";

if (GROQ_API_KEY.startsWith("gsk_YOUR")) {
  console.warn("⚠️ Using placeholder API Key. Please update llmService.ts or .env file.");
}

const llm = new ChatGroq({
  apiKey: GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.1,
});

export interface TranslationResult {
  original: string;
  translatedScript: string;
  phoneticHinglish: string;
}

export async function generateAudioFriendlyTranslation(
  text: string,
  targetLang: string = "Hindi",
  onChunk?: (chunk: string) => void,
  onPhoneticChunk?: (chunk: string) => void
): Promise<TranslationResult> {
  console.log(`[LLM] Processing (Stream): "${text}" -> ${targetLang}`);

  try {
    const translationResponse = await llm.invoke([
      new SystemMessage(
        `You are a strict, precise translator.

Translate the user's exact text into ${targetLang}.

RULES:
1. Output ONLY the translated text using the native script of ${targetLang}.
2. DO NOT answer questions. If the user asks a question, translate the question itself. 
3. DO NOT carry on a conversation.
4. DO NOT add placeholders, brackets, or template text (like "Fill your name here").
5. Keep the translation natural and conversational, not literal.
6. Preserve proper nouns in their original form.
7. Use Latin characters ONLY if the target language is English.`
      ),
      new HumanMessage(text),
    ]);

    let translatedText = translationResponse.content.toString().trim();
    // Strip quotes if LLM added them
    translatedText = translatedText.replace(/^["']|["']$/g, '');

    if (onChunk) onChunk(translatedText);

    const phoneticResponse = await llm.invoke([
      new SystemMessage(
        `You are a strict phonetic transliteration system.

Convert the following ${targetLang} text into its pronunciation using the Latin alphabet.

Rules:

1. Output ONLY the pronunciation. Do not include explanations, translations, labels, or markdown.
2. Preserve the original word order and punctuation.
3. Separate words with spaces.
4. Use simple English phonetic spelling that reflects how the sentence sounds when spoken.
5. Use plain Latin letters only (a–z).
6. Avoid linguistic or academic transliteration systems (no diacritics like ā, ī, ṭ, ñ).
7. Keep the pronunciation natural and easy for an English speaker to read aloud.

Examples:
Input: आपसे मिलकर खुशी हुई।
Output: aapase milakar khushee huee.

Input: आपका घर थोड़ा बड़ा है।
Output: aapaka ghar thoda bada hai.`
      ),
      new HumanMessage(translatedText),
    ]);

    let phoneticText = phoneticResponse.content.toString().trim();
    // Strip quotes if LLM added them
    phoneticText = phoneticText.replace(/^["']|["']$/g, '');

    if (onPhoneticChunk) onPhoneticChunk(phoneticText);

    return {
      original: text,
      translatedScript: translatedText,
      phoneticHinglish: phoneticText
    };

  } catch (error) {
    console.error("LLM Translation Failed:", error);
    // Return a safe fallback so the app doesn't crash
    return {
      original: text,
      translatedScript: "Error connecting to AI",
      phoneticHinglish: "Please check your internet or API Key"
    };
  }
}