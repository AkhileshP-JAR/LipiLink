import React, { useState, useEffect, useRef } from 'react';
import { AudioRecorder } from '@/components/AudioRecorder';
import { TranscriptionDisplay } from '@/components/TranscriptionDisplay';
import { TextToSpeech } from '@/components/TextToSpeech';
import { TranslationTestComponent } from '@/components/TranslationTestComponent';
import { transliterateText, translateText, testApiConnectivity } from '@/utils/ai4bharat-api';
import { Languages, Mic, Bug, CheckCircle, XCircle, Type, Loader2, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const [originalText, setOriginalText] = useState('');
  const [hinglishText, setHinglishText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ transliteration: boolean; translation: boolean } | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isManualProcessing, setIsManualProcessing] = useState(false);
  const [voiceTypedText, setVoiceTypedText] = useState('');
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const [voiceEditorOpen, setVoiceEditorOpen] = useState(false);
  const voiceTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const originalIsHindi = /[\u0900-\u097F]/.test(originalText);

  // Test API connectivity on component mount
  useEffect(() => {
    testApiConnectivity().then(setApiStatus);
  }, []);

  // Simple name mapping rules: Latin name -> preferred Latin form, and preferred -> Hindi
  const NAME_PREFERRED: Record<string, string> = {
    'schloke': 'Shlok'
  };
  const NAME_TO_HINDI: Record<string, string> = {
    'shlok': 'श्लोक'
  };

  // Small name -> gender map. Extend this list as needed or make editable in the UI.
  // Keys are lowercase forms of the Latin name.
  const NAME_GENDER: Record<string, 'male' | 'female'> = {
    'mahek': 'female',
    'mehek': 'female',
    'mahak': 'female',
    'shlok': 'male',
    'shloké': 'male'
  };

  // Persisted name->gender map (user editable). Stored in localStorage to improve detection.
  const [nameGenderMap, setNameGenderMap] = useState<Record<string, 'male' | 'female'>>({});
  const [newNameInput, setNewNameInput] = useState('');
  const [newNameGender, setNewNameGender] = useState<'male' | 'female'>('female');
  // Pending gender inference that requires user confirmation before persisting
  const [pendingGenderInference, setPendingGenderInference] = useState<{
    name: string;
    gender: 'male' | 'female';
    probability: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vtl_name_gender');
      if (raw) setNameGenderMap(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load nameGenderMap', e);
    }
  }, []);

  const saveNameGenderMap = (m: Record<string, 'male' | 'female'>) => {
    setNameGenderMap(m);
    try { localStorage.setItem('vtl_name_gender', JSON.stringify(m)); } catch (e) { /* ignore */ }
  };

  const addNameGender = (name: string, gender: 'male' | 'female') => {
    const k = name.trim().toLowerCase();
    if (!k) return;
    const next = { ...nameGenderMap, [k]: gender };
    saveNameGenderMap(next);
  };

  const removeNameGender = (name: string) => {
    const k = name.trim().toLowerCase();
    if (!k) return;
    const next = { ...nameGenderMap };
    delete next[k];
    saveNameGenderMap(next);
  };

  const acceptPendingInference = () => {
    if (!pendingGenderInference) return;
    const { name, gender } = pendingGenderInference;
    const next = { ...nameGenderMap, [name]: gender };
    saveNameGenderMap(next);
    setPendingGenderInference(null);
  };

  const rejectPendingInference = () => {
    setPendingGenderInference(null);
  };

  // Enhanced gender detection heuristics. Returns an object with a gender label and
  // a confidence score (0..1). For backward compatibility with earlier code
  // we keep a small wrapper that returns only the label when needed.
  const detectGenderFromEnglish = (text: string): { gender: 'male' | 'female' | 'unknown'; confidence: number; reason?: string; nameCandidate?: string | null } => {
    if (!text) return { gender: 'unknown', confidence: 0 };
    const s = text.trim();
    const low = s.toLowerCase();

    // Strong explicit identity patterns
    const explicit = low.match(/\b(i am a|i'm a|i am an|i'm an)\s+(boy|girl|man|woman|female|male)\b/);
    if (explicit) {
      const token = explicit[2];
      if (/(boy|man|male)/.test(token)) return { gender: 'male', confidence: 0.98, reason: 'explicit-identity' };
      if (/(girl|woman|female)/.test(token)) return { gender: 'female', confidence: 0.98, reason: 'explicit-identity' };
    }

    // Pronoun counts (we use a tiny scoring scheme)
    let score = 0;
    const malePronouns = (low.match(/\b(he|him|his)\b/g) || []).length;
    const femalePronouns = (low.match(/\b(she|her|hers)\b/g) || []).length;
    score += (malePronouns - femalePronouns) * 0.25;

    // Honorifics and titles are strong signals when attached to a name
    if (/\b(mr\.|mr)\b/i.test(s)) score += 0.6;
    if (/\b(ms\.|mrs\.|miss|mrs)\b/i.test(s)) score -= 0.6; // negative -> female-friendly

    // Role/title indicators (small, conservative list)
    const maleIndicators = ['father', 'husband', 'son', 'brother', 'uncle', 'mr', 'sir', 'actor', 'actor.'];
    const femaleIndicators = ['mother', 'wife', 'daughter', 'sister', 'aunt', 'mrs', 'ms', 'miss', 'nurse', 'actress'];
    for (const w of maleIndicators) if (new RegExp('\\b' + escapeRegExp(w) + '\\b', 'i').test(s)) score += 0.18;
    for (const w of femaleIndicators) if (new RegExp('\\b' + escapeRegExp(w) + '\\b', 'i').test(s)) score -= 0.18;

    // Name-based exact match: 'my name is X' or 'name is X'
    const nameMatch = low.match(/\bmy name is\s+([a-zA-Z']{2,30})\b/) || low.match(/\bname is\s+([a-zA-Z']{2,30})\b/);
    if (nameMatch && nameMatch[1]) {
      const nm = nameMatch[1].toLowerCase();
      if (nameGenderMap[nm]) return { gender: nameGenderMap[nm], confidence: 0.99, reason: 'explicit-name-map', nameCandidate: nm };
      if (NAME_GENDER[nm]) return { gender: NAME_GENDER[nm], confidence: 0.95, reason: 'default-name-map', nameCandidate: nm };
      // if we have a literal "my name is X", return a weak candidate for later external lookup
      return { gender: 'unknown', confidence: 0.45, reason: 'name-candidate', nameCandidate: nm };
    }

    // Token-level name lookup: check persisted map and defaults
    for (const [nm, g] of Object.entries(nameGenderMap)) {
      const re = new RegExp('\\b' + nm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(s)) return { gender: g, confidence: 0.9, reason: 'persisted-name' };
    }
    for (const [nm, g] of Object.entries(NAME_GENDER)) {
      const re = new RegExp('\\b' + nm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(s)) return { gender: g, confidence: 0.85, reason: 'default-name' };
    }

    // Convert numeric score into a normalized confidence
    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    let confidence = Math.tanh(Math.abs(score)) * 0.6; // keep conservative
    if (score > 0.4) { gender = 'male'; confidence = Math.min(0.98, 0.6 + (score - 0.4)); }
    else if (score < -0.4) { gender = 'female'; confidence = Math.min(0.98, 0.6 + (-score - 0.4)); }

    return { gender, confidence: Number(confidence.toFixed(2)), reason: 'heuristic-pronouns' };
  };

  // Backwards-compatible simple wrapper
  const detectGenderFromEnglishSimple = (text: string): 'male' | 'female' | 'unknown' => detectGenderFromEnglish(text).gender;

  // Query Genderize.io for a probabilistic gender inference for a given first name.
  // Returns an object with gender|null, probability (0..1) and count.
  async function inferGenderFromName(name: string): Promise<{ gender: 'male' | 'female' | null; probability: number; count: number } | null> {
    if (!name) return null;
    try {
      const clean = name.trim().split('\n')[0].split(' ')[0];
      const url = `https://api.genderize.io?name=${encodeURIComponent(clean)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      // data: { name: string, gender: 'male'|'female'|null, probability: '0.00', count: 0 }
      const gender = (data.gender || null) as ('male'|'female'|null);
      const prob = Math.max(0, Math.min(1, parseFloat(data.probability || '0')));
      const count = parseInt(data.count || '0', 10) || 0;
      return { gender, probability: Number(isNaN(prob) ? 0 : prob), count };
    } catch (e) {
      // ignore network errors
      return null;
    }
  }

  // Async wrapper: try heuristics first, then fall back to Genderize.io when a name is present.
  // If Genderize returns a confident result, persist it to nameGenderMap for future use.
  const detectGenderAuto = async (text: string): Promise<'male'|'female'|'unknown'> => {
    // 1) heuristics
    const h = detectGenderFromEnglish(text);
    if (h.gender !== 'unknown' && h.confidence >= 0.8) return h.gender;

    // 2) attempt to extract a name candidate (explicit "my name is X" or capitalized token)
    const s = (text || '').trim();
    const low = s.toLowerCase();
    const nameMatch = low.match(/\bmy name is\s+([a-zA-Z']{2,30})\b/) || low.match(/\bname is\s+([a-zA-Z']{2,30})\b/);
    let candidate: string | null = null;
    if (nameMatch && nameMatch[1]) candidate = nameMatch[1];

    if (!candidate) {
      const words = (text || '').split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (/^[A-Z][a-z]/.test(w)) { candidate = w; break; }
      }
    }

    if (candidate) {
      const k = candidate.toLowerCase();
      // 2a) check persisted map first
      if (nameGenderMap[k]) return nameGenderMap[k];

      // 2b) call Genderize to try to infer
      const inferred = await inferGenderFromName(candidate);
      if (inferred && inferred.gender) {
        // Strong rule: if very high probability and reasonable count, persist automatically
        if (inferred.probability >= 0.92 && inferred.count >= 10) {
          const next = { ...nameGenderMap, [k]: inferred.gender };
          saveNameGenderMap(next);
          return inferred.gender;
        }

        // Otherwise, surface a pending confirmation to the user (do not silently persist)
        // We'll set UI state with pending inference for manual accept/reject.
        setPendingGenderInference({ name: k, gender: inferred.gender, probability: inferred.probability, count: inferred.count });
        return inferred.gender;
      }
    }

    // 3) if heuristics had a weak suggestion (confidence >= 0.5) use it but don't persist
    if (h.gender !== 'unknown' && h.confidence >= 0.5) return h.gender;

    return 'unknown';
  };

  // Prompt-steering: add a small English hint so translators are more likely to produce
  // gender-aware Hindi output. We prefix the source English with a short clause.
  const applyPromptSteering = (text: string, gender: 'male' | 'female' | 'unknown') => {
    if (!text || gender === 'unknown') return text;
    if (gender === 'female') return `As a female, ${text}`;
    if (gender === 'male') return `As a male, ${text}`;
    return text;
  };

  // After translation, many translations will begin with a phrase like "एक महिला के रूप में".
  // Strip common translated gender-prefixes so the final Hindi reads naturally while
  // preserving the inflected verb forms.
  const stripGenderPrefixFromHindi = (hindi: string, gender: 'male' | 'female' | 'unknown') => {
    if (!hindi || gender === 'unknown') return hindi;
    let out = hindi;
    // common prefixes to remove. These are conservative and focused on cases where
    // the translator injected a gender-clause at the start because we used prompt-steering
    // (e.g., "As a female, ..." -> "एक महिला के रूप में ..."). We target forms that
    // commonly occur and are followed by a first-person clause (e.g., "मेरा नाम", "मैं ...").
    const femalePatterns = [
      // exact "एक महिला के रूप में" optionally followed by punctuation/whitespace
      '^\\s*एक\\s+महिला\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*महिला\\s+के\\s+रूप\\s+में[,।\\s]*',
      // "एक महिला" at start when followed shortly by first-person markers
      '^\\s*एक\\s+महिला\\s*(,|:|\.|)?\\s*(मेरा|मेरी|मैं|मुझे|नाम)\\b',
      // girl variants
      '^\\s*एक\\s+लड़की\\s*(,|:|\.|)?\\s*(मेरा|मेरी|मैं|मुझे|नाम)\\b',
      '^\\s*लड़की\\s*(,|:|\.|)?\\s*(मेरा|मेरी|मैं|मुझे|नाम)\\b'
    ];

    const malePatterns = [
      '^\\s*एक\\s+पुरुष\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*एक\\s+लड़का\\s*(,|:|\.|)?\\s*(मेरा|मेरी|मैं|मुझे|नाम)\\b',
      '^\\s*पुरुष\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*एक\\s+पुरुष[,।\\s]*'
    ];

    const patterns = gender === 'female' ? femalePatterns : malePatterns;
    for (const p of patterns) {
      const re = new RegExp(p, 'i');
      out = out.replace(re, '');
    }

    // Final trim and normalize stray punctuation at the start
    out = out.replace(/^[:,।\-\s]+/, '').trim();
    return out;
  };

  // Noun gender adjustments: map some English nouns to female/male Hindi forms when detected.
  // This is a small, editable mapping you can expand. It is applied when the English input
  // contains the English key and a gender is detected.
  const NOUN_GENDER_MAP: Record<string, { male: string; female: string }> = {
    'student': { male: 'छात्र', female: 'छात्रा' },
    'teacher': { male: 'शिक्षक', female: 'शिक्षिका' },
    'actor': { male: 'अभिनेता', female: 'अभिनेत्री' },
  };

  const applyNounGenderAdjustments = (hindiText: string, englishSource: string, gender: 'male' | 'female' | 'unknown') => {
    if (!hindiText || gender === 'unknown') return hindiText;
    let out = hindiText;
    const s = englishSource.toLowerCase();
    for (const [eng, forms] of Object.entries(NOUN_GENDER_MAP)) {
      if (s.includes(eng)) {
        // Replace common male form in Hindi if present
        try {
          const maleRe = new RegExp(forms.male.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), 'g');
          const femaleForm = gender === 'female' ? forms.female : forms.male;
          if (maleRe.test(out)) {
            out = out.replace(maleRe, femaleForm);
          } else {
            // fallback: replace latinized form 'student' translit 'स्टूडेंट' if present
            const latinish = eng;
            const latinRe = new RegExp(latinish, 'gi');
            out = out.replace(latinRe, femaleForm);
          }
        } catch (e) {
          // ignore
        }
      }
    }
    // Adjust genitive particles (का/की/के) that precede gendered nouns for cases like
    // "अंतिम वर्ष का छात्र" -> "अंतिम वर्ष की छात्रा" when gender is female.
    try {
      const desiredParticle = gender === 'female' ? 'की' : 'का';
      // Build a regex that matches any of the noun forms (male or female) we care about
      const nounForms = Object.values(NOUN_GENDER_MAP).flatMap(f => [f.male, f.female]).map(n => n.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
      if (nounForms.length > 0) {
        const nounGroup = nounForms.join('|');
        // Match (का|की|के) optionally surrounded by whitespace/punctuation before the noun
        const particleRe = new RegExp('\\b(का|की|के)\\s+(' + nounGroup + ')\\b', 'g');
        out = out.replace(particleRe, (_m, _oldParticle, noun) => {
          return desiredParticle + ' ' + noun;
        });
      }
    } catch (e) {
      // ignore any regex errors
    }
    // Phrase-based fixes: handle common English->Hindi phrase translations where the
    // translator might produce "अंतिम वर्ष का छात्र". We look for known English phrase
    // anchors in the source and then update nearby particles in the Hindi output.
    try {
      const phraseAnchors: Record<string, string[]> = {
        'final year': ['अंतिम वर्ष', 'आखिरी वर्ष'],
        'first year': ['पहला वर्ष', 'प्रथम वर्ष'],
        'second year': ['दूसरा वर्ष'],
        'third year': ['तीसरा वर्ष'],
        'class representative': ['क्लास प्रतिनिधि', 'कक्षा प्रतिनिधि', 'क्लास रिप्रेजेंटेटिव'],
        'student': ['छात्र', 'छात्रा', 'स्टूडेंट']
      };

      for (const [engPhrase, anchors] of Object.entries(phraseAnchors)) {
        if (!englishSource.toLowerCase().includes(engPhrase)) continue;
        const desiredParticle = gender === 'female' ? 'की' : 'का';
        for (const anchor of anchors) {
          // Replace occurrences like "अंतिम वर्ष का" -> "अंतिम वर्ष की"
          const re = new RegExp('(' + anchor.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ')\\s*[,\-–—]?\\s*(का|की|के)\\b', 'gi');
          out = out.replace(re, (_m, a) => `${a} ${desiredParticle}`);
        }
      }
    } catch (e) {
      // swallow
    }
    return out;
  };

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizeLatinNames = (input: string) => {
    if (!input) return input;
    let out = input;
    for (const [k, v] of Object.entries(NAME_PREFERRED)) {
      const re = new RegExp('\\b' + escapeRegExp(k) + '\\b', 'gi');
      out = out.replace(re, v);
    }
    return out;
  };

  const convertPreferredToHindi = (input: string) => {
    if (!input) return input;
    let out = input;
    for (const [k, v] of Object.entries(NAME_TO_HINDI)) {
      const re = new RegExp('\\b' + escapeRegExp(k) + '\\b', 'gi');
      out = out.replace(re, v);
    }
    return out;
  };

  // Heuristic gender adjustment for Hindi text. This is a light-weight post-processing
  // pass that fixes common verb/adjective endings (e.g. "रहा/रही", "गया/गई", "था/थी", "हुआ/हुई")
  // when the user forces a speaker gender. 'auto' means no forced changes.
  const applyGenderToHindi = (text: string, gender: 'auto' | 'male' | 'female') => {
    if (!text || gender === 'auto') return text;
    const isFemale = gender === 'female';
    const replacements: Array<[RegExp, string]> = [
      [/\bकर\s+रहा\b/gi, isFemale ? 'कर रही' : 'कर रहा'],
      [/\bजा\s+रहा\b/gi, isFemale ? 'जा रही' : 'जा रहा'],
      [/\bआ\s+रहा\b/gi, isFemale ? 'आ रही' : 'आ रहा'],
      [/\bरहा\b/gi, isFemale ? 'रही' : 'रहा'],
      [/\bरही\b/gi, isFemale ? 'रही' : 'रहा'],
      [/\bगया\b/gi, isFemale ? 'गई' : 'गया'],
      [/\bगई\b/gi, isFemale ? 'गई' : 'गया'],
      [/\bगए\b/gi, isFemale ? 'गई' : 'गया'],
      [/\bथा\b/gi, isFemale ? 'थी' : 'था'],
      [/\bथी\b/gi, isFemale ? 'थी' : 'था'],
      [/\bहुआ\b/gi, isFemale ? 'हुई' : 'हुआ'],
      [/\bहुई\b/gi, isFemale ? 'हुई' : 'हुआ'],
      // fallback: common participle endings
      [/ा गया\b/gi, isFemale ? 'ा गयी' : 'ा गया'],
      [/ा गयी\b/gi, isFemale ? 'ा गयी' : 'ा गया']
    ];

    let out = text;
    for (const [r, rep] of replacements) {
      out = out.replace(r, rep);
    }
    // Additional heuristics for first-person verb agreement and common token fixes
    if (isFemale) {
      // fix common OCR/transliteration mistakes
      out = out.replace(/\bमे\b/g, 'मैं');
      // normalize common 'hu' forms to the correct nukta form
      out = out.replace(/हूं/g, 'हूँ');

      // verbs that end with 'ता' followed by auxiliaries like 'हूँ/है/हैं' -> change to 'ती'
      out = out.replace(/([\u0900-\u097F]+?)ता(?=\s+(हूँ|हूं|है|हैं|हूँ\.|है\.|हैं\.))/gi, '$1ती');

      // specific common verbs (safe list) — e.g., पढ़ता हूं -> पढ़ती हूँ
      out = out.replace(/पढ़ता\s+(हूं|हूँ|हुं|हूं)/gi, 'पढ़ती हूँ');
      out = out.replace(/जा रहा\b/gi, 'जा रही');
      out = out.replace(/आ रहा\b/gi, 'आ रही');
      out = out.replace(/कर रहा\b/gi, 'कर रही');
    } else {
      // Ensure normalization for male forms as well
      out = out.replace(/हूं/g, 'हूँ');
    }
    return out;
  };

  // Manual text processing function
  const processManualText = async (text: string) => {
    if (!text.trim()) {
      setOriginalText('');
      setHinglishText('');
      setTargetText('');
      return;
    }

    console.log('[MANUAL] Processing manual input:', text);
    const normalizedOriginal = normalizeLatinNames(text);
    setOriginalText(normalizedOriginal);
    setIsManualProcessing(true);

    try {
      if (/[\u0900-\u097F]/.test(text)) {
        // Contains Devanagari script (Hindi) - process as Hindi
        console.log('[MANUAL] Processing as Hindi text');

        // CORRECT FLOW: Hindi → English translation first, then Hindi → Hinglish transliteration
        const adjusted = convertPreferredToHindi(text);
        const [englishTranslation, hinglishTransliteration] = await Promise.all([
          translateText(adjusted, 'hi', 'en'),
          transliterateText(adjusted, 'hi', 'en')
        ]);

        console.log('[MANUAL] English translation result:', englishTranslation);
        console.log('[MANUAL] Hinglish transliteration result:', hinglishTransliteration);

        setTargetText(englishTranslation);
        setHinglishText(hinglishTransliteration);
      } else {
        // Treat as English text - translate to Hindi, then transliterate Hindi->Hinglish
        console.log('[MANUAL] Processing as English text');
        // Normalize names in English before translating
        const englishWithPreferredNames = normalizeLatinNames(text);
  // Auto-detect gender from the English input (async: heuristics + Genderize)
  const detected = await detectGenderAuto(text);
        // Apply prompt-steering to encourage gender-aware translation
        const steered = applyPromptSteering(englishWithPreferredNames, detected);
        let hindiTranslation = await translateText(steered, 'en', 'hi');
        // convert preferred names
        hindiTranslation = convertPreferredToHindi(hindiTranslation);
        // strip translated gender prefix and apply heuristics
        hindiTranslation = stripGenderPrefixFromHindi(hindiTranslation, detected);
        // noun-level adjustments (student -> छात्रा etc.)
        hindiTranslation = applyNounGenderAdjustments(hindiTranslation, englishWithPreferredNames, detected);
        if (detected !== 'unknown') {
          hindiTranslation = applyGenderToHindi(hindiTranslation, detected);
        }
        const hinglishFromHindi = await transliterateText(hindiTranslation, 'hi', 'en');
        console.log('[MANUAL] English->Hindi translation result:', hindiTranslation);
        console.log('[MANUAL] Hinglish-from-Hindi result:', hinglishFromHindi);

        setTargetText(hindiTranslation);
        setHinglishText(hinglishFromHindi || '');
      }
    } catch (error) {
      console.error('[MANUAL] Error processing text:', error);
      // Fallback to original text
      setHinglishText(text);
      setTargetText(text);
    } finally {
      setIsManualProcessing(false);
    }
  };

  // Test API functionality
  const testApis = async () => {
    console.log('[TEST] Testing API functionality...');
    const testText = 'नमस्ते';
    
    try {
      const [translation, transliteration] = await Promise.all([
        translateText(testText, 'hi', 'en'),
        transliterateText(testText, 'hi', 'en')
      ]);
      
      console.log('[TEST] Translation result:', translation);
      console.log('[TEST] Transliteration result:', transliteration);
      
      // Update the display with test results
      setOriginalText(testText);
      setTargetText(translation);
      setHinglishText(transliteration);
    } catch (error) {
      console.error('[TEST] API test failed:', error);
    }
  };

  // Debounced manual text processing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (manualInput.trim()) {
        processManualText(manualInput);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [manualInput]);

  // Auto-process the voice-typed text as the user edits it (debounced).
  useEffect(() => {
    const id = setTimeout(() => {
      if (voiceTypedText.trim()) processManualText(voiceTypedText);
    }, 700);
    return () => clearTimeout(id);
  }, [voiceTypedText]);

  const handleTranscription = async (text: string) => {
    console.log('[MAIN] Original transcribed text:', text);
    console.log('[MAIN] Text contains Devanagari?', /[\u0900-\u097F]/.test(text));

    const normalizedOriginal = normalizeLatinNames(text);
    // Populate the UI's original text and also mirror the transcription into
    // the editable inputs so users can quickly edit the recognized text.
    setOriginalText(normalizedOriginal);
    // Populate the typed transcript input under the mic so users can see/edit the
    // raw transcription returned from the backend. Also copy into the manual input
    // so the Manual tab shows the same content and the user can edit there too.
    setVoiceTypedText(normalizedOriginal);
    setManualInput(normalizedOriginal);
    // Auto-open the transcript editor (unlimited threshold = always open)
    setVoiceEditorOpen(true);
    // Focus the textarea inside the dialog and move the caret to the end
    setTimeout(() => {
      try {
        if (voiceTextareaRef.current) {
          const ta = voiceTextareaRef.current;
          ta.focus();
          const len = ta.value?.length || 0;
          ta.selectionStart = ta.selectionEnd = len;
          // scroll to bottom to ensure caret is visible for long transcripts
          ta.scrollTop = ta.scrollHeight;
        } else {
          voiceInputRef.current?.focus();
        }
      } catch (e) {}
    }, 80);
    setIsProcessing(true);

    try {
      if (/[\u0900-\u097F]/.test(text)) {
        // Contains Devanagari script (Hindi) - process as Hindi
        console.log('[MAIN] Processing as Hindi text');

        // Hindi -> English translation and Hinglish transliteration
        const adjusted = convertPreferredToHindi(text);
        const [englishTranslation, hinglishTransliteration] = await Promise.all([
          translateText(adjusted, 'hi', 'en'),
          transliterateText(adjusted, 'hi', 'en')
        ]);

        console.log('[MAIN] English translation result:', englishTranslation);
        console.log('[MAIN] Hinglish transliteration result:', hinglishTransliteration);

        setTargetText(englishTranslation);
        setHinglishText(hinglishTransliteration);
      } else {
        // Treat as English input
        console.log('[MAIN] Processing as English text');

        // Translate English -> Hindi, then transliterate Hindi -> Hinglish (Latin script)
        // Convert preferred Latin names to the preferred Latin form before translating
        const englishWithPreferredNames = normalizeLatinNames(text);
  const detected = await detectGenderAuto(text);
        const steered = applyPromptSteering(englishWithPreferredNames, detected);
        let hindiTranslation = await translateText(steered, 'en', 'hi');
        // Ensure known names are converted to the desired Hindi form
        hindiTranslation = convertPreferredToHindi(hindiTranslation);
        // Remove any translated gender-prefix injected by the steering step
        hindiTranslation = stripGenderPrefixFromHindi(hindiTranslation, detected);
        // noun-level adjustments (student -> छात्रा etc.)
        hindiTranslation = applyNounGenderAdjustments(hindiTranslation, englishWithPreferredNames, detected);
        // Apply heuristics as a final fallback
        if (detected !== 'unknown') {
          hindiTranslation = applyGenderToHindi(hindiTranslation, detected);
        }

        let hinglishFromHindi = '';
        try {
          hinglishFromHindi = await transliterateText(hindiTranslation, 'hi', 'en');
        } catch (e) {
          console.warn('[MAIN] Hinglish transliteration failed, continuing without it', e);
        }

        console.log('[MAIN] Hindi translation result:', hindiTranslation);
        console.log('[MAIN] Hinglish-from-Hindi result:', hinglishFromHindi);

        // For English input: originalText = English, targetText = Hindi translation
        setTargetText(hindiTranslation);
        setHinglishText(hinglishFromHindi || '');
      }
    } catch (error) {
      console.error('[MAIN] Error processing text:', error);
      // Fallback to original text
      setHinglishText(text);
      setTargetText(text);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Debug Mode Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setDebugMode(!debugMode)}
          variant={debugMode ? "default" : "outline"}
          size="sm"
          className="flex items-center gap-2"
        >
          <Bug className="w-4 h-4" />
          Debug
        </Button>
      </div>

      {/* API Status Indicator */}
      {apiStatus && (
        <div className="fixed top-4 left-4 z-50">
          <Card className="p-2">
            <div className="flex items-center gap-2 text-xs">
              <span>APIs:</span>
              <Badge variant={apiStatus.transliteration ? "default" : "destructive"} className="flex items-center gap-1">
                {apiStatus.transliteration ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                Transliterate
              </Badge>
              <Badge variant={apiStatus.translation ? "default" : "destructive"} className="flex items-center gap-1">
                {apiStatus.translation ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                Translate
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-10" />
        <div className="relative container mx-auto px-4 py-16 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-3 rounded-full gradient-primary">
                  <Languages className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  VoiceScript
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Transform your voice into multiple languages with AI-powered transliteration. 
                Speak naturally and get instant Hinglish and English conversions.
              </p>
            </div>
            
            <div className="float-animation">
              <Tabs defaultValue="voice" className="w-full max-w-2xl mx-auto">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="voice" className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Voice Input
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Manual Input
                  </TabsTrigger>
                  <TabsTrigger value="test" className="flex items-center gap-2">
                    <TestTube className="w-4 h-4" />
                    Test Translation
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="voice" className="mt-6">
                  <AudioRecorder
                    onTranscription={handleTranscription}
                    onProcessing={(v)=>setIsProcessing(v)}
                    translatedText={targetText}
                    hinglishText={hinglishText}
                    targetLanguage={originalIsHindi ? 'English' : 'Hindi'}
                    originalText={originalText}
                  />
                  {/* Typed input alternative to speaking */}
                  <div className="mt-4 max-w-xl mx-auto">
                    <Label className="text-sm font-medium">Or type your sentence</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Type here instead of speaking..."
                        value={voiceTypedText}
                        onChange={(e) => setVoiceTypedText(e.target.value)}
                        ref={(el) => (voiceInputRef.current = el)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { processManualText(voiceTypedText); } }}
                      />
                      <Button onClick={() => processManualText(voiceTypedText)}>Process</Button>
                      <Dialog open={voiceEditorOpen} onOpenChange={setVoiceEditorOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">Edit transcript</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Transcript</DialogTitle>
                          </DialogHeader>
                          <div className="mt-2">
                            <Textarea ref={(el) => (voiceTextareaRef.current = el)} value={voiceTypedText} onChange={(e) => setVoiceTypedText(e.target.value)} className="min-h-[160px]" />
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button size="sm" onClick={() => { processManualText(voiceTypedText); setVoiceEditorOpen(false); }}>Save & Process</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button size="sm" variant="outline">Cancel</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {isProcessing && (
                    <div className="mt-3 text-sm text-muted-foreground flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing audio...
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="manual" className="mt-6">
                  <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="manual-input" className="text-sm font-medium">
                          Enter Hindi Text
                        </Label>
                        <div className="relative">
                          <Input
                            id="manual-input"
                            type="text"
                            placeholder="Type or paste Hindi text here..."
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            className="pr-10"
                          />
                          {isManualProcessing && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            const example = "My name is Schloke. I am a boy. I like to dance. I eat healthy food.";
                            setManualInput(example);
                            processManualText(example);
                          }}>Load Example</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Results will update automatically as you type
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="test" className="mt-6">
                  <TranslationTestComponent />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* Transcription Results */}
      {originalText && (
        <div className="container mx-auto px-4 py-16">
          <div className="space-y-8">
            <TranscriptionDisplay
              originalText={originalText}
              hinglishText={hinglishText}
              targetText={targetText}
              targetLanguage={originalIsHindi ? 'English' : 'Hindi'}
              debugMode={debugMode}
            />
            
            <div className="flex justify-center">
              <TextToSpeech
                hinglishText={hinglishText}
                targetText={targetText}
                targetLanguage={originalIsHindi ? 'English' : 'Hindi'}
              />
            </div>

            {/* Debug Information */}
            {debugMode && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader>
                  <CardTitle className="text-yellow-800 flex items-center gap-2">
                    <Bug className="w-5 h-5" />
                    Debug Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-2">Original Text:</h4>
                      <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded">
                        {originalText}
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        Contains Devanagari: {/[\u0900-\u097F]/.test(originalText) ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-2">Hinglish Output:</h4>
                      <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded">
                        {hinglishText}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-2">English Output:</h4>
                      <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded">
                        {targetText}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-yellow-600">
                    <p>Processing Status: {isProcessing ? 'Processing...' : isManualProcessing ? 'Manual Processing...' : 'Complete'}</p>
                    <p>API Status: Transliteration: {apiStatus?.transliteration ? '✅' : '❌'}, Translation: {apiStatus?.translation ? '✅' : '❌'}</p>
                    <p>Input Mode: {manualInput ? 'Manual Text' : 'Voice Recording'}</p>
                    <div className="mt-2">
                      <Button 
                        onClick={testApis} 
                        size="sm" 
                        variant="outline"
                        className="text-xs"
                      >
                        Test APIs with "नमस्ते"
                      </Button>
                    </div>
                    {/* Editable name->gender map for better detection */}
                    <div className="mt-4">
                      <h5 className="font-semibold text-yellow-800">Name → Gender (editable)</h5>
                      {/* Pending inferred gender (user confirmation) */}
                      {pendingGenderInference && (
                        <div className="mt-2 p-3 bg-yellow-100 border border-yellow-200 rounded text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">Inferred gender for <span className="italic">{pendingGenderInference.name}</span></p>
                              <p className="text-muted-foreground">Gender: <strong>{pendingGenderInference.gender}</strong> · Confidence: {(pendingGenderInference.probability * 100).toFixed(0)}% · Data points: {pendingGenderInference.count}</p>
                              <p className="mt-1 text-xs text-yellow-700">Accept to save this mapping for future automatic detection, or reject to ignore.</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Button size="sm" onClick={acceptPendingInference}>Accept</Button>
                              <Button size="sm" variant="destructive" onClick={rejectPendingInference}>Reject</Button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Name (e.g., Mahek)"
                          value={newNameInput}
                          onChange={(e) => setNewNameInput(e.target.value)}
                          className="text-xs"
                        />
                        <select value={newNameGender} onChange={(e) => setNewNameGender(e.target.value as 'male' | 'female')} className="text-xs px-2 rounded border">
                          <option value="female">female</option>
                          <option value="male">male</option>
                        </select>
                        <Button size="sm" onClick={() => { addNameGender(newNameInput, newNameGender); setNewNameInput(''); }}>Add</Button>
                      </div>

                      <div className="mt-2 text-xs">
                        {Object.keys(nameGenderMap).length === 0 ? (
                          <p className="text-muted-foreground">No custom names added.</p>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(nameGenderMap).map(([n, g]) => (
                              <div key={n} className="flex items-center justify-between gap-2 bg-yellow-50/30 p-2 rounded">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{n}</span>
                                  <span className="text-muted-foreground">{g}</span>
                                </div>
                                <Button size="sm" variant="destructive" onClick={() => removeNameGender(n)}>Remove</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full gradient-primary flex items-center justify-center">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Record</h3>
              <p className="text-muted-foreground">
                Click the microphone and speak in Hindi, English, or any supported language
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full gradient-secondary flex items-center justify-center">
                <Languages className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Transform</h3>
              <p className="text-muted-foreground">
                AI instantly converts your speech to Hinglish and target language
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full gradient-accent flex items-center justify-center">
                <Languages className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Listen</h3>
              <p className="text-muted-foreground">
                Play back the converted text in natural-sounding voices
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;