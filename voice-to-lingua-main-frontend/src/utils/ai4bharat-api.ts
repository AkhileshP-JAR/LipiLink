// AI4Bharat API integration utilities with multiple fallback options
// Based on: https://github.com/AI4Bharat/indic-transliteration and https://github.com/AI4Bharat/indic-trans2

interface TransliterationRequest {
  text: string;
  source_lang: string;
  target_lang: string;
}

interface TransliterationResponse {
  output: string[];
}

interface TranslationRequest {
  text: string;
  source_lang: string;
  target_lang: string;
}

interface TranslationResponse {
  output: string[];
}

// Multiple API endpoints to try
const TRANSLITERATION_ENDPOINTS = [
  'https://api.ai4bharat.org/transliterate',
  'https://indic-transliterate.herokuapp.com/transliterate',
  'https://transliterate-api.herokuapp.com/transliterate'
];

const TRANSLATION_ENDPOINTS = [
  'https://api.ai4bharat.org/translate',
  'https://indic-translate.herokuapp.com/translate',
  'https://translate-api.herokuapp.com/translate'
];

// AI4Bharat Indic Transliterate API with multiple fallbacks
export async function transliterateText(
  text: string, 
  sourceLang: string = 'hi', 
  targetLang: string = 'en'
): Promise<string> {
  console.log(`[TRANSLITERATION] Starting transliteration: ${text} (${sourceLang} → ${targetLang})`);
  
  // Try multiple endpoints
  for (const endpoint of TRANSLITERATION_ENDPOINTS) {
    try {
      console.log(`[TRANSLITERATION] Trying endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      });

      if (response.ok) {
        const data: TransliterationResponse = await response.json();
        const result = data.output?.[0] || text;
        
        console.log(`[TRANSLITERATION] Success with ${endpoint}: ${result}`);
        return result;
      } else {
        console.log(`[TRANSLITERATION] Failed with ${endpoint}: ${response.status}`);
      }
    } catch (error) {
      console.log(`[TRANSLITERATION] Error with ${endpoint}:`, error);
    }
  }
  
  // All API endpoints failed, use fallback
  console.log('[TRANSLITERATION] All API endpoints failed, using fallback');
  return fallbackTransliteration(text, sourceLang, targetLang);
}

// AI4Bharat IndicTrans2 Translation API with multiple fallbacks
export async function translateText(
  text: string, 
  sourceLang: string = 'hi', 
  targetLang: string = 'en'
): Promise<string> {
  console.log(`[TRANSLATION] Starting translation: ${text} (${sourceLang} → ${targetLang})`);
  
  // Try multiple endpoints
  for (const endpoint of TRANSLATION_ENDPOINTS) {
    try {
      console.log(`[TRANSLATION] Trying endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      });

      if (response.ok) {
        const data: TranslationResponse = await response.json();
        const result = data.output?.[0] || text;
        
        console.log(`[TRANSLATION] Success with ${endpoint}: ${result}`);
        return result;
      } else {
        console.log(`[TRANSLATION] Failed with ${endpoint}: ${response.status}`);
      }
    } catch (error) {
      console.log(`[TRANSLATION] Error with ${endpoint}:`, error);
    }
  }
  
  // Try Google Translate API as fallback
  try {
    console.log('[TRANSLATION] Trying Google Translate API fallback');
    return await googleTranslateFallback(text, sourceLang, targetLang);
  } catch (error) {
    console.log('[TRANSLATION] Google Translate fallback failed:', error);
  }
  
  // All API endpoints failed, use local fallback
  console.log('[TRANSLATION] All API endpoints failed, using local fallback');
  return fallbackTranslation(text, sourceLang, targetLang);
}

// Google Translate API fallback (free tier)
async function googleTranslateFallback(text: string, sourceLang: string, targetLang: string): Promise<string> {
  // Using a public Google Translate proxy
  const proxyUrl = 'https://translate.googleapis.com/translate_a/single';
  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: targetLang,
    dt: 't',
    q: text
  });
  
  const response = await fetch(`${proxyUrl}?${params}`);
  if (!response.ok) {
    throw new Error(`Google Translate API error: ${response.status}`);
  }
  
  const data = await response.json();
  // Google Translate returns an array of segments in data[0].
  // Join all translated segments to form the full translated text.
  const segments = data[0] || [];
  const result = segments.map((seg: any) => seg?.[0] || '').join('') || text;
  
  console.log(`[GOOGLE_TRANSLATE] Result: ${result}`);
  return result;
}

// Fallback transliteration using local mapping
function fallbackTransliteration(text: string, sourceLang: string, targetLang: string): string {
  if (sourceLang === 'hi' && targetLang === 'en') {
    return hindiToHinglishFallback(text);
  }
  return text;
}

// Fallback translation using local mapping
function fallbackTranslation(text: string, sourceLang: string, targetLang: string): string {
  if (sourceLang === 'hi' && targetLang === 'en') {
    return hindiToEnglishFallback(text);
  }
  return text;
}

// Enhanced Hindi to Hinglish fallback
function hindiToHinglishFallback(text: string): string {
  const hindiToHinglishMap: Record<string, string> = {
    // Basic vowels
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    
    // Consonants
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h',
    
    // Vowel signs
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    
    // Special characters
    '्': '', 'ं': 'n', 'ः': 'h',
  };

  const commonHindiWords: Record<string, string> = {
    'नमस्ते': 'namaste',
    'धन्यवाद': 'dhanyawad',
    'कैसे': 'kaise',
    'क्या': 'kya',
    'कहाँ': 'kahan',
    'कब': 'kab',
    'कौन': 'kaun',
    'क्यों': 'kyon',
    'हाँ': 'haan',
    'नहीं': 'nahin',
    'अच्छा': 'achha',
    'बुरा': 'bura',
    'बड़ा': 'bada',
    'छोटा': 'chota',
    'पानी': 'paani',
    'खाना': 'khaana',
    'घर': 'ghar',
    'स्कूल': 'school',
    'दोस्त': 'dost',
    'माता': 'mata',
    'पिता': 'pita',
    'भाई': 'bhai',
    'बहन': 'behen',
    'मैं': 'main',
    'आप': 'aap',
    'तुम': 'tum',
    'है': 'hai',
    'हैं': 'hain',
    'हूँ': 'hoon',
    'था': 'tha',
    'थी': 'thi',
  };

  let result = text;
  
  // First try to match common words
  Object.entries(commonHindiWords).forEach(([hindi, hinglish]) => {
    const regex = new RegExp(hindi, 'g');
    result = result.replace(regex, hinglish);
  });
  
  // Improved character-by-character transliteration with implicit vowel handling
  const vowelSigns = new Set(['ा','ि','ी','ु','ू','े','ै','ो','ौ','ॉ','ॆ','ॊ']);
  const virama = '्';

  // Set of Devanagari consonants we map above
  const consonants = new Set([
    'क','ख','ग','घ','ङ',
    'च','छ','ज','झ','ञ',
    'ट','ठ','ड','ढ','ण',
    'त','थ','द','ध','न',
    'प','फ','ब','भ','म',
    'य','र','ल','व','श','ष','स','ह'
  ]);

  let out = '';
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];

    // whitespace and punctuation pass-through
    if (/\s/.test(ch)) { out += ch; continue; }

    // If it's a mapped consonant
    if (consonants.has(ch)) {
      const base = hindiToHinglishMap[ch] || ch;
      const next = result[i+1];
      // If next is a vowel sign or virama (halant) or nukta, do not append implicit 'a'
      if (next && (vowelSigns.has(next) || next === virama || next === '़')) {
        out += base;
      } else {
        // insert implicit 'a' after consonant (common in Hindi)
        out += base + 'a';
      }
      continue;
    }

    // If it's a vowel letter or sign or other mapped char
    if (hindiToHinglishMap[ch]) {
      out += hindiToHinglishMap[ch];
      continue;
    }

    // Default: append as-is (for punctuation, Latin, etc.)
    out += ch;
  }

  // collapse multiple spaces
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

// Enhanced Hindi to English fallback with more comprehensive mapping
function hindiToEnglishFallback(text: string): string {
  const hindiToEnglishMap: Record<string, string> = {
    // Greetings and common phrases
    'नमस्ते': 'hello',
    'नमस्कार': 'namaskar',
    'धन्यवाद': 'thank you',
    'शुक्रिया': 'thanks',
    'कृपया': 'please',
    'माफ करें': 'sorry',
    'क्षमा करें': 'excuse me',
    
    // Question words
    'कैसे': 'how',
    'क्या': 'what',
    'कहाँ': 'where',
    'कब': 'when',
    'कौन': 'who',
    'क्यों': 'why',
    'कितना': 'how much',
    'कितनी': 'how much',
    'कैसा': 'how/what kind',
    'कैसी': 'how/what kind',
    
    // Responses
    'हाँ': 'yes',
    'नहीं': 'no',
    'ठीक है': 'okay',
    'अच्छा': 'good',
    'बुरा': 'bad',
    'बहुत अच्छा': 'very good',
    'बहुत बुरा': 'very bad',
    
    // Adjectives
    'बड़ा': 'big',
    'छोटा': 'small',
    'लंबा': 'tall/long',
    
    'मोटा': 'fat/thick',
    'पतला': 'thin',
    'सुंदर': 'beautiful',
    'बदसूरत': 'ugly',
    'नया': 'new',
    'पुराना': 'old',
    'गर्म': 'hot',
    'ठंडा': 'cold',
    
    // Family
    'माता': 'mother',
    'पिता': 'father',
    'माँ': 'mom',
    'पापा': 'dad',
    'भाई': 'brother',
    'बहन': 'sister',
    'दादा': 'grandfather',
    'दादी': 'grandmother',
    'पति': 'husband',
    'पत्नी': 'wife',
    'बेटा': 'son',
    'बेटी': 'daughter',
    'दोस्त': 'friend',
    
    // Pronouns
    'मैं': 'I',
    'मैंने': 'I',
    'तुम': 'you',
    'आप': 'you (respectful)',
    'वह': 'he/she/it',
    'वे': 'they',
    'हम': 'we',
    'हमारा': 'our',
    'तुम्हारा': 'your',
    'उसका': 'his/her/its',
    
    // Verbs
    'है': 'is',
    'हैं': 'are',
    'हूँ': 'am',
    'था': 'was',
    'थी': 'was',
    'थे': 'were',
    'होगा': 'will be',
    'होगी': 'will be',
    'करना': 'to do',
    'करता': 'does',
    'करती': 'does',
    'कर रहा': 'is doing',
    'कर रही': 'is doing',
    'जाना': 'to go',
    'आना': 'to come',
    'खाना': 'to eat',
    'पीना': 'to drink',
    'सोना': 'to sleep',
    'उठना': 'to wake up',
    'बैठना': 'to sit',
    'खड़ा होना': 'to stand',
    'चलना': 'to walk',
    'दौड़ना': 'to run',
    'बोलना': 'to speak',
    'सुनना': 'to listen',
    'देखना': 'to see',
    'पढ़ना': 'to read',
    'लिखना': 'to write',
    
    // Common nouns
    'घर': 'house',
    'स्कूल': 'school',
    'कॉलेज': 'college',
    'दफ्तर': 'office',
    'बाजार': 'market',
    'पानी': 'water',
    
    'रोटी': 'bread',
    'चावल': 'rice',
    'दूध': 'milk',
    'चाय': 'tea',
    'कॉफी': 'coffee',
    'फल': 'fruit',
    'सब्जी': 'vegetable',
    'किताब': 'book',
    'कलम': 'pen',
    'कागज': 'paper',
    'कंप्यूटर': 'computer',
    'फोन': 'phone',
    'कार': 'car',
    'बस': 'bus',
    'ट्रेन': 'train',
    'हवाई जहाज': 'airplane',
    'पैसा': 'money',
    'समय': 'time',
    'दिन': 'day',
    'रात': 'night',
    'सुबह': 'morning',
    'शाम': 'evening',
    'सप्ताह': 'week',
    'महीना': 'month',
    'साल': 'year',
    
    // Places
    'भारत': 'India',
    'अमेरिका': 'America',
    'इंग्लैंड': 'England',
    'दिल्ली': 'Delhi',
    'मुंबई': 'Mumbai',
    'बैंगलोर': 'Bangalore',
    'चेन्नई': 'Chennai',
    'कोलकाता': 'Kolkata',
    
    // Common phrases
    'मैं ठीक हूँ': 'I am fine',
    'आप कैसे हैं': 'how are you',
    'मुझे समझ नहीं आया': 'I don\'t understand',
    'मुझे पता नहीं': 'I don\'t know',
    'कृपया मदद करें': 'please help',
    'मुझे भूख लगी है': 'I am hungry',
    'मुझे प्यास लगी है': 'I am thirsty',
    'यह क्या है': 'what is this',
    'यह कहाँ है': 'where is this',
    'यह कब होगा': 'when will this happen',
    'मैं जा रहा हूँ': 'I am going',
    'मैं आ रहा हूँ': 'I am coming',
    'मैं खा रहा हूँ': 'I am eating',
    'मैं पी रहा हूँ': 'I am drinking',
    'मैं सो रहा हूँ': 'I am sleeping',
    'मैं पढ़ रहा हूँ': 'I am reading',
    'मैं लिख रहा हूँ': 'I am writing',
    'मैं बोल रहा हूँ': 'I am speaking',
    'मैं सुन रहा हूँ': 'I am listening',
    'मैं देख रहा हूँ': 'I am seeing',
  };

  let result = text;
  
  // Apply phrase-level translations first (longer phrases first)
  const sortedEntries = Object.entries(hindiToEnglishMap).sort((a, b) => b[0].length - a[0].length);
  
  for (const [hindi, english] of sortedEntries) {
    const regex = new RegExp(hindi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, english);
  }
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  console.log(`[FALLBACK_TRANSLATION] Hindi: "${text}" → English: "${result}"`);
  return result;
}

// Debug utility to test API connectivity
export async function testApiConnectivity(): Promise<{ transliteration: boolean; translation: boolean }> {
  console.log('[DEBUG] Testing API connectivity...');
  
  const testText = 'नमस्ते';
  
  let transliterationWorking = false;
  let translationWorking = false;
  
  try {
    await transliterateText(testText, 'hi', 'en');
    transliterationWorking = true;
    console.log('[DEBUG] Transliteration API: ✅ Working');
  } catch (error) {
    console.log('[DEBUG] Transliteration API: ❌ Failed');
  }
  
  try {
    await translateText(testText, 'hi', 'en');
    translationWorking = true;
    console.log('[DEBUG] Translation API: ✅ Working');
  } catch (error) {
    console.log('[DEBUG] Translation API: ❌ Failed');
  }
  
  return { transliteration: transliterationWorking, translation: translationWorking };
}
