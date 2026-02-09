import React, { useState, useEffect, useRef } from 'react';
import { AudioRecorder } from '@/components/AudioRecorder';
import { TranscriptionDisplay } from '@/components/TranscriptionDisplay';
import { TextToSpeech } from '@/components/TextToSpeech';
import { TranslationTestComponent } from '@/components/TranslationTestComponent';

// 1. Swap the imports: Remove old API, Add new LLM Service
// import { transliterateText, translateText, testApiConnectivity } from '@/utils/ai4bharat-api'; <--- REMOVED
import { generateAudioFriendlyTranslation } from '@/utils/llmService'; // <--- ADDED

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
  const [manualInput, setManualInput] = useState('');
  const [isManualProcessing, setIsManualProcessing] = useState(false);
  const [voiceTypedText, setVoiceTypedText] = useState('');
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const [voiceEditorOpen, setVoiceEditorOpen] = useState(false);
  const voiceTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const originalIsHindi = /[\u0900-\u097F]/.test(originalText);

  // Simple name mapping rules
  const NAME_PREFERRED: Record<string, string> = {
    'schloke': 'Shlok'
  };
  const NAME_TO_HINDI: Record<string, string> = {
    'shlok': 'श्लोक'
  };

  const NAME_GENDER: Record<string, 'male' | 'female'> = {
    'mahek': 'female', 'mehek': 'female', 'mahak': 'female', 'shlok': 'male', 'shloké': 'male'
  };

  const [nameGenderMap, setNameGenderMap] = useState<Record<string, 'male' | 'female'>>({});
  const [newNameInput, setNewNameInput] = useState('');
  const [newNameGender, setNewNameGender] = useState<'male' | 'female'>('female');
  const [pendingGenderInference, setPendingGenderInference] = useState<{
    name: string; gender: 'male' | 'female'; probability: number; count: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vtl_name_gender');
      if (raw) setNameGenderMap(JSON.parse(raw));
    } catch (e) { console.warn('Failed to load nameGenderMap', e); }
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

  // --- Gender Detection Logic (Preserved as it helps the LLM) ---
  const detectGenderFromEnglish = (text: string): { gender: 'male' | 'female' | 'unknown'; confidence: number; reason?: string; nameCandidate?: string | null } => {
    if (!text) return { gender: 'unknown', confidence: 0 };
    const s = text.trim();
    const low = s.toLowerCase();

    const explicit = low.match(/\b(i am a|i'm a|i am an|i'm an)\s+(boy|girl|man|woman|female|male)\b/);
    if (explicit) {
      const token = explicit[2];
      if (/(boy|man|male)/.test(token)) return { gender: 'male', confidence: 0.98, reason: 'explicit-identity' };
      if (/(girl|woman|female)/.test(token)) return { gender: 'female', confidence: 0.98, reason: 'explicit-identity' };
    }

    let score = 0;
    const malePronouns = (low.match(/\b(he|him|his)\b/g) || []).length;
    const femalePronouns = (low.match(/\b(she|her|hers)\b/g) || []).length;
    score += (malePronouns - femalePronouns) * 0.25;

    if (/\b(mr\.|mr)\b/i.test(s)) score += 0.6;
    if (/\b(ms\.|mrs\.|miss|mrs)\b/i.test(s)) score -= 0.6;

    const maleIndicators = ['father', 'husband', 'son', 'brother', 'uncle', 'mr', 'sir', 'actor'];
    const femaleIndicators = ['mother', 'wife', 'daughter', 'sister', 'aunt', 'mrs', 'ms', 'miss', 'nurse', 'actress'];
    for (const w of maleIndicators) if (new RegExp('\\b' + escapeRegExp(w) + '\\b', 'i').test(s)) score += 0.18;
    for (const w of femaleIndicators) if (new RegExp('\\b' + escapeRegExp(w) + '\\b', 'i').test(s)) score -= 0.18;

    const nameMatch = low.match(/\bmy name is\s+([a-zA-Z']{2,30})\b/) || low.match(/\bname is\s+([a-zA-Z']{2,30})\b/);
    if (nameMatch && nameMatch[1]) {
      const nm = nameMatch[1].toLowerCase();
      if (nameGenderMap[nm]) return { gender: nameGenderMap[nm], confidence: 0.99, reason: 'explicit-name-map', nameCandidate: nm };
      if (NAME_GENDER[nm]) return { gender: NAME_GENDER[nm], confidence: 0.95, reason: 'default-name-map', nameCandidate: nm };
      return { gender: 'unknown', confidence: 0.45, reason: 'name-candidate', nameCandidate: nm };
    }

    for (const [nm, g] of Object.entries(nameGenderMap)) {
      if (new RegExp('\\b' + nm + '\\b', 'i').test(s)) return { gender: g, confidence: 0.9, reason: 'persisted-name' };
    }
    for (const [nm, g] of Object.entries(NAME_GENDER)) {
      if (new RegExp('\\b' + nm + '\\b', 'i').test(s)) return { gender: g, confidence: 0.85, reason: 'default-name' };
    }

    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    let confidence = Math.tanh(Math.abs(score)) * 0.6;
    if (score > 0.4) { gender = 'male'; confidence = Math.min(0.98, 0.6 + (score - 0.4)); }
    else if (score < -0.4) { gender = 'female'; confidence = Math.min(0.98, 0.6 + (-score - 0.4)); }

    return { gender, confidence: Number(confidence.toFixed(2)), reason: 'heuristic-pronouns' };
  };

  async function inferGenderFromName(name: string): Promise<{ gender: 'male' | 'female' | null; probability: number; count: number } | null> {
    if (!name) return null;
    try {
      const clean = name.trim().split('\n')[0].split(' ')[0];
      const res = await fetch(`https://api.genderize.io?name=${encodeURIComponent(clean)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const gender = (data.gender || null) as ('male'|'female'|null);
      const prob = Math.max(0, Math.min(1, parseFloat(data.probability || '0')));
      return { gender, probability: Number(isNaN(prob) ? 0 : prob), count: parseInt(data.count || '0', 10) || 0 };
    } catch (e) { return null; }
  }

  const detectGenderAuto = async (text: string): Promise<'male'|'female'|'unknown'> => {
    const h = detectGenderFromEnglish(text);
    if (h.gender !== 'unknown' && h.confidence >= 0.8) return h.gender;

    const s = (text || '').trim();
    const low = s.toLowerCase();
    const nameMatch = low.match(/\bmy name is\s+([a-zA-Z']{2,30})\b/) || low.match(/\bname is\s+([a-zA-Z']{2,30})\b/);
    let candidate: string | null = null;
    if (nameMatch && nameMatch[1]) candidate = nameMatch[1];
    if (!candidate) {
      const words = (text || '').split(/\s+/).filter(Boolean);
      for (const w of words) { if (/^[A-Z][a-z]/.test(w)) { candidate = w; break; } }
    }

    if (candidate) {
      const k = candidate.toLowerCase();
      if (nameGenderMap[k]) return nameGenderMap[k];
      const inferred = await inferGenderFromName(candidate);
      if (inferred && inferred.gender) {
        if (inferred.probability >= 0.92 && inferred.count >= 10) {
          addNameGender(k, inferred.gender);
          return inferred.gender;
        }
        setPendingGenderInference({ name: k, gender: inferred.gender, probability: inferred.probability, count: inferred.count });
        return inferred.gender;
      }
    }
    if (h.gender !== 'unknown' && h.confidence >= 0.5) return h.gender;
    return 'unknown';
  };

  // Prompt-steering: we still use this to give the LLM context
  const applyPromptSteering = (text: string, gender: 'male' | 'female' | 'unknown') => {
    if (!text || gender === 'unknown') return text;
    if (gender === 'female') return `As a female, ${text}`;
    if (gender === 'male') return `As a male, ${text}`;
    return text;
  };

  const stripGenderPrefixFromHindi = (hindi: string, gender: 'male' | 'female' | 'unknown') => {
    if (!hindi || gender === 'unknown') return hindi;
    let out = hindi;
    // Common prefixes LLM might generate if steered too hard
    const prefixes = [
      '^\\s*एक\\s+महिला\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*महिला\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*एक\\s+पुरुष\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*पुरुष\\s+के\\s+रूप\\s+में[,।\\s]*'
    ];
    for (const p of prefixes) {
      out = out.replace(new RegExp(p, 'i'), '');
    }
    return out.replace(/^[:,।\-\s]+/, '').trim();
  };

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizeLatinNames = (input: string) => {
    if (!input) return input;
    let out = input;
    for (const [k, v] of Object.entries(NAME_PREFERRED)) {
      out = out.replace(new RegExp('\\b' + escapeRegExp(k) + '\\b', 'gi'), v);
    }
    return out;
  };

  // --- NEW UNIFIED PROCESSING LOGIC (LLM) ---

  const processManualText = async (text: string) => {
    if (!text.trim()) {
      setOriginalText(''); setHinglishText(''); setTargetText('');
      return;
    }

    console.log('[MANUAL] Processing manual input:', text);
    const normalizedOriginal = normalizeLatinNames(text);
    setOriginalText(normalizedOriginal);
    setIsManualProcessing(true);

    try {
      if (/[\u0900-\u097F]/.test(text)) {
        // CASE 1: HINDI INPUT -> Translate to English
        console.log('[MANUAL] Processing as Hindi text');
        
        // Use new LLM service to translate Hindi -> English
        const data = await generateAudioFriendlyTranslation(text, 'English');
        
        console.log('[MANUAL] Result:', data);
        setTargetText(data.translatedScript); // English Translation
        
        // For Hindi input, "Hinglish" (transliteration) is less relevant in output 
        // unless we want Romanized English (which is just English).
        // We'll leave it empty or set to same as English for now.
        setHinglishText(data.phoneticHinglish); 

      } else {
        // CASE 2: ENGLISH INPUT -> Translate to Hindi (Main Feature)
        console.log('[MANUAL] Processing as English text');
        
        // 1. Detect Gender
        const detectedGender = await detectGenderAuto(text);
        
        // 2. Steer the prompt (Add "As a male/female" context)
        const steeredText = applyPromptSteering(normalizedOriginal, detectedGender);
        
        // 3. Call LLM
        const data = await generateAudioFriendlyTranslation(steeredText, 'Hindi');
        
        // 4. Cleanup (Remove "As a female..." if it leaked into translation)
        const cleanHindi = stripGenderPrefixFromHindi(data.translatedScript, detectedGender);
        
        console.log('[MANUAL] Result:', data);
        setTargetText(cleanHindi);       // Hindi Script
        setHinglishText(data.phoneticHinglish); // Phonetic Hinglish
      }
    } catch (error) {
      console.error('[MANUAL] Error processing text:', error);
      setHinglishText("Error: Check API Key");
      setTargetText(text);
    } finally {
      setIsManualProcessing(false);
    }
  };

  // Debounced manual processing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (manualInput.trim()) processManualText(manualInput);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [manualInput]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (voiceTypedText.trim()) processManualText(voiceTypedText);
    }, 700);
    return () => clearTimeout(id);
  }, [voiceTypedText]);

  // --- Voice Processing (Identical logic to Manual) ---
  const handleTranscription = async (text: string) => {
    console.log('[MAIN] Transcribed text:', text);
    const normalizedOriginal = normalizeLatinNames(text);
    
    setOriginalText(normalizedOriginal);
    setVoiceTypedText(normalizedOriginal);
    setManualInput(normalizedOriginal);
    setVoiceEditorOpen(true);
    setIsProcessing(true);

    try {
      if (/[\u0900-\u097F]/.test(text)) {
        // Hindi Input -> English
        const data = await generateAudioFriendlyTranslation(text, 'English');
        setTargetText(data.translatedScript);
        setHinglishText(data.phoneticHinglish);
      } else {
        // English Input -> Hindi (With Gender Context)
        const detectedGender = await detectGenderAuto(text);
        const steeredText = applyPromptSteering(normalizedOriginal, detectedGender);
        
        const data = await generateAudioFriendlyTranslation(steeredText, 'Hindi');
        const cleanHindi = stripGenderPrefixFromHindi(data.translatedScript, detectedGender);
        
        setTargetText(cleanHindi);
        setHinglishText(data.phoneticHinglish);
      }
    } catch (error) {
      console.error('[MAIN] Error:', error);
      setHinglishText("Processing Failed");
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
                  {/* Typed input alternative */}
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
                      
                      {/* Transcript Editor Dialog */}
                      <Dialog open={voiceEditorOpen} onOpenChange={setVoiceEditorOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">Edit transcript</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Transcript</DialogTitle>
                          </DialogHeader>
                          <div className="mt-2">
                            <Textarea 
                              ref={(el) => (voiceTextareaRef.current = el)} 
                              value={voiceTypedText} 
                              onChange={(e) => setVoiceTypedText(e.target.value)} 
                              className="min-h-[160px]" 
                            />
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button size="sm" onClick={() => { processManualText(voiceTypedText); setVoiceEditorOpen(false); }}>Save & Process</Button>
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
                          Enter Text
                        </Label>
                        <div className="relative">
                          <Input
                            id="manual-input"
                            type="text"
                            placeholder="Type text here..."
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            className="pr-10"
                          />
                          {isManualProcessing && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
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
                      <h4 className="font-semibold text-yellow-800 mb-2">Original:</h4>
                      <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded">{originalText}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-2">Hinglish (Phonetic):</h4>
                      <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded">{hinglishText}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-2">Target Script:</h4>
                      <p className="text-yellow-700 font-mono bg-yellow-100 p-2 rounded">{targetText}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h5 className="font-semibold text-yellow-800">Name → Gender Map</h5>
                    {Object.keys(nameGenderMap).length === 0 ? <p className="text-xs">None</p> : (
                       <div className="text-xs mt-1 space-y-1">
                         {Object.entries(nameGenderMap).map(([n, g]) => (
                           <span key={n} className="inline-block bg-yellow-100 px-2 py-1 rounded mr-2">{n}: {g}</span>
                         ))}
                       </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;