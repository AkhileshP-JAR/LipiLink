// Simple transliteration utilities
// This is a basic implementation - in production, you'd use more sophisticated libraries

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
  '्': '', // halant (virama)
  'ं': 'n', // anusvara
  'ः': 'h', // visarga
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
};

export function hindiToHinglish(text: string): string {
  if (!text) return '';
  
  console.log('Converting Hindi to Hinglish:', text);
  
  // First try to match common words
  let result = text;
  Object.entries(commonHindiWords).forEach(([hindi, hinglish]) => {
    const regex = new RegExp(hindi, 'g');
    result = result.replace(regex, hinglish);
  });
  
  // Then do character-by-character transliteration for remaining text
  result = result.split('').map(char => {
    return hindiToHinglishMap[char] || char;
  }).join('');
  
  // If no conversion happened and it's still in Devanagari, return the original
  // This handles cases where the speech recognition might return romanized Hindi
  if (result === text && /[\u0900-\u097F]/.test(text)) {
    console.log('No transliteration mapping found, keeping original');
  }
  
  console.log('Hindi to Hinglish result:', result);
  return result;
}

export function englishToHinglish(text: string): string {
  if (!text) return '';
  
  console.log('Converting English to Hinglish:', text);
  
  // Simple phonetic conversion for common English words
  const englishToHinglishMap: Record<string, string> = {
    'hello': 'hello',
    'hi': 'hi',
    'how are you': 'aap kaise hain',
    'thank you': 'dhanyawad',
    'good': 'achha',
    'bad': 'bura',
    'yes': 'haan',
    'no': 'nahin',
    'water': 'paani',
    'food': 'khaana',
    'house': 'ghar',
    'school': 'school',
    'friend': 'dost',
    'mother': 'mummy',
    'father': 'papa',
    'brother': 'bhai',
    'sister': 'didi',
    'what': 'kya',
    'where': 'kahan',
    'when': 'kab',
    'how': 'kaise',
    'why': 'kyon',
    'who': 'kaun',
    'i am': 'main hoon',
    'you are': 'aap hain',
    'this is': 'yeh hai',
    'that is': 'woh hai',
  };
  
  let result = text.toLowerCase();
  Object.entries(englishToHinglishMap).forEach(([english, hinglish]) => {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    result = result.replace(regex, hinglish);
  });
  
  // If no significant conversion happened, try to keep some English words mixed
  if (result.toLowerCase() === text.toLowerCase()) {
    // Add some Hinglish flavor to common English words
    result = result.replace(/\bthe\b/gi, '').replace(/\s+/g, ' ').trim();
  }
  
  console.log('English to Hinglish result:', result);
  return result;
}

export function translateToEnglish(text: string): string {
  if (!text) return '';
  
  console.log('Translating to English:', text);
  
  // First handle complete phrase patterns for better semantic accuracy
  const phrasePatterns: Record<string, string> = {
    // Education-specific phrases and common constructions first
    // e.g., "bachelors ka student" → "a bachelors student"
    'bachelors?\\s+ka\\s+student': 'a bachelors student',

    // Name introductions
    // Use a non-greedy, comma-safe capture for the name
    'mera naam\\s+([^,]+?)\\s+hai': 'my name is $1',
    'meraa naam\\s+([^,]+?)\\s+hai': 'my name is $1',
    'mera nam\\s+([^,]+?)\\s+hai': 'my name is $1',

    // Self description variants (main/mai/mein/me)
    'main\\s+([^,]+?)\\s+hoon': 'I am $1',
    'main\\s+([^,]+?)\\s+hun': 'I am $1',
    'mai\\s+([^,]+?)\\s+hoon': 'I am $1',
    'mai\\s+([^,]+?)\\s+hun': 'I am $1',
    'mein\\s+([^,]+?)\\s+hoon': 'I am $1',
    'mein\\s+([^,]+?)\\s+hun': 'I am $1',
    'me\\s+([^,]+?)\\s+hoon': 'I am $1',
    'me\\s+([^,]+?)\\s+hun': 'I am $1',
    
    // Greetings and common phrases
    'namaste (.+)': 'hello $1',
    'namaste': 'hello',
    'aap kaise hain': 'how are you',
    'aap kaisi hain': 'how are you',
    'main achha hoon': 'I am good',
    'main theek hoon': 'I am fine',
    'dhanyawad': 'thank you',
    
    // Questions
    'aapka naam kya hai': 'what is your name',
    'tumhara naam kya hai': 'what is your name',
    'yeh kya hai': 'what is this',
    'woh kya hai': 'what is that',
    'aap kahan rehte hain': 'where do you live',
    'aap kya karte hain': 'what do you do',
    
    // Basic responses
    'haan bilkul': 'yes absolutely',
    'nahin bilkul nahin': 'no not at all',
    'pata nahin': 'I don\'t know',
    'samajh gaya': 'I understand',
    'samajh nahin aaya': 'I don\'t understand',
    
    // Common action patterns
    'kya kr rhaa hai': 'what are you doing',
    'kya kar rhaa hai': 'what are you doing',
    'kya kar raha hai': 'what are you doing',
    'kya ho rhaa hai': 'what is happening',
    'kya ho raha hai': 'what is happening',
    'tujhe ptaa nahin': 'you don\'t know',
    'tujhe pata nahin': 'you don\'t know',
    'tujhe pata nahi': 'you don\'t know',
    'mujhe pata nahin': 'I don\'t know',
    'mujhe pata nahi': 'I don\'t know',
    'kya chal rhaa hai': 'what is going on',
    'kya chal raha hai': 'what is going on',
    
    // Specific common phrases
    'bhai too kya kr rhaa hai': 'brother what are you doing',
    'tujhe ptaa nahin kya ho rhaa hai': 'you don\'t know what is happening',
  };
  
  let result = text.toLowerCase().trim();
  
  // Apply phrase-level translations first
  Object.entries(phrasePatterns).forEach(([pattern, replacement]) => {
    const regex = new RegExp(pattern, 'gi');
    result = result.replace(regex, replacement);
  });
  
  // Then handle individual word translations for remaining untranslated words
  const wordTranslations: Record<string, string> = {
    // Pronouns and basic words
    'main': 'I',
    'mein': 'I',
    'mai': 'I',
    'aap': 'you',
    'tum': 'you',
    'too': 'you',
    'tu': 'you',
    'hum': 'we',
    'woh': 'he/she/that',
    'yeh': 'this',
    'ye': 'this',
    
    // Verbs
    'hai': 'is',
    'hain': 'are',
    'hoon': 'am',
    'hun': 'am',
    'tha': 'was',
    'thi': 'was',
    'the': 'were',
    'hoga': 'will be',
    'hogi': 'will be',
    'karta': 'do/does',
    'karti': 'do/does',
    'karte': 'do',
    'kr': 'doing',
    'kar': 'doing',
    'rhaa': 'is/are',
    'raha': 'is/are',
    'rahi': 'is/are',
    'rahe': 'are',
    'ho': 'be',
    'chal': 'going',
    'chal rhaa': 'going on',
    'chal raha': 'going on',
    
    // Question words
    'kya': 'what',
    'kaun': 'who',
    'kahan': 'where',
    'kab': 'when',
    'kaise': 'how',
    'kaisi': 'how',
    'kyon': 'why',
    'kyun': 'why',
    'kitna': 'how much',
    'kitni': 'how much',
    
    // Common nouns
    'naam': 'name',
    'nam': 'name',
    'ghar': 'house',
    'kaam': 'work',
    'paani': 'water',
    'khaana': 'food',
    'samay': 'time',
    'din': 'day',
    'raat': 'night',
    'subah': 'morning',
    'shaam': 'evening',
    'pta': 'know',
    'pata': 'know',
    
    // Family
    'mummy': 'mother',
    'papa': 'father',
    'bhai': 'brother',
    'behen': 'sister',
    'didi': 'sister',
    'dost': 'friend',
    
    // Adjectives
    'achha': 'good',
    'accha': 'good',
    'bura': 'bad',
    'buraa': 'bad',
    'bada': 'big',
    'badaa': 'big',
    'chota': 'small',
    'chhota': 'small',
    'naya': 'new',
    'purana': 'old',
    'sundar': 'beautiful',
    
    // Common responses
    'haan': 'yes',
    'nahin': 'no',
    'nahi': 'no',
    'theek': 'okay/fine',
    'bilkul': 'absolutely',
    'shayad': 'maybe',
    'zaroor': 'definitely',
    
    // Greetings
    'hello': 'hello',
    'helo': 'hello',
    'namaste': 'hello',
    'alvida': 'goodbye',
    'phir milenge': 'see you later',
  };
  
  // Apply word-level translations
  Object.entries(wordTranslations).forEach(([hinglish, english]) => {
    const regex = new RegExp(`\\b${hinglish}\\b`, 'gi');
    result = result.replace(regex, english);
  });
  
  // Clean up extra spaces and fix basic grammar
  result = result
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^i am (.+)$/, 'I am $1') // Capitalize I
    .replace(/\bi\b/g, 'I') // Always capitalize I
    .replace(/\bwhat is\b/gi, 'what is') // Fix common patterns
    .replace(/\bwhat are\b/gi, 'what are')
    .replace(/\byou don't know\b/gi, 'you don\'t know')
    .replace(/\bwhat is happening\b/gi, 'what is happening');
  
  console.log('Translation to English result:', result);
  return result;
}