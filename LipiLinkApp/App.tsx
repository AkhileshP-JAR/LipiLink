import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform, 
  StatusBar 
} from 'react-native';
import { Feather } from '@expo/vector-icons';

// Custom Components
import AudioRecorder from './components/AudioRecorder';
import TextToSpeech from './components/TextToSpeech';

// Logic & Theme
import { generateAudioFriendlyTranslation } from './utils/llmService';
import { lightTheme, darkTheme, Theme } from './utils/theme';

export default function App() {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState<'voice' | 'manual'>('voice');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [originalText, setOriginalText] = useState('');
  const [hinglishText, setHinglishText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [targetLangCode, setTargetLangCode] = useState<string>('hi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  // --- LOGIC: HELPER FUNCTIONS (Ported from Web) ---
  const NAME_PREFERRED: Record<string, string> = { 'schloke': 'Shlok' };
  const NAME_GENDER: Record<string, 'male' | 'female'> = {
    'mahek': 'female', 'mehek': 'female', 'mahak': 'female', 'shlok': 'male'
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

  const detectGenderAuto = async (text: string): Promise<'male'|'female'|'unknown'> => {
    const s = text.trim().toLowerCase();
    
    // 1. Check Pronouns
    let score = 0;
    const malePronouns = (s.match(/\b(he|him|his)\b/g) || []).length;
    const femalePronouns = (s.match(/\b(she|her|hers)\b/g) || []).length;
    score += (malePronouns - femalePronouns);

    // 2. Check Explicit Identity
    if (s.match(/\b(i am|i'm)\s+(a\s+)?(boy|man|male)\b/)) return 'male';
    if (s.match(/\b(i am|i'm)\s+(a\s+)?(girl|woman|female)\b/)) return 'female';

    // 3. Check Name Map
    for (const [nm, g] of Object.entries(NAME_GENDER)) {
      if (new RegExp('\\b' + nm + '\\b', 'i').test(s)) return g;
    }

    if (score > 0) return 'male';
    if (score < 0) return 'female';
    return 'unknown';
  };

  const applyPromptSteering = (text: string, gender: 'male' | 'female' | 'unknown') => {
    if (!text || gender === 'unknown') return text;
    if (gender === 'female') return `As a female, ${text}`;
    if (gender === 'male') return `As a male, ${text}`;
    return text;
  };

  const stripGenderPrefixFromHindi = (hindi: string) => {
    if (!hindi) return hindi;
    // Remove common LLM prefixes like "As a female..." in Hindi
    const prefixes = [
      '^\\s*एक\\s+महिला\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*महिला\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*एक\\s+पुरुष\\s+के\\s+रूप\\s+में[,।\\s]*',
      '^\\s*पुरुष\\s+के\\s+रूप\\s+में[,।\\s]*'
    ];
    let out = hindi;
    for (const p of prefixes) {
      out = out.replace(new RegExp(p, 'i'), '');
    }
    return out.replace(/^[:,।\-\s]+/, '').trim();
  };

  // --- CORE PROCESSING ---
  const processText = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setOriginalText(text); // Update UI immediately

    try {
      const normalizedOriginal = normalizeLatinNames(text);
      
      const langMap: Record<string, string> = {
        'hi': 'Hindi', 'en': 'English', 'mr': 'Marathi',  'ja': 'Japanese',
        'ta': 'Tamil', 'te': 'Telugu'
      };
      const targetLangName = langMap[targetLangCode] || 'English';

      // Clear previous outputs
      setTargetText("");
      setHinglishText("");
      
      const gender = await detectGenderAuto(text);
      const steeredText = applyPromptSteering(normalizedOriginal, gender);
      
      await generateAudioFriendlyTranslation(
        steeredText, 
        targetLangName,
        (chunk) => {
           let cleanText = chunk;
           if (targetLangCode === 'hi' || targetLangCode === 'mr') {
             cleanText = stripGenderPrefixFromHindi(chunk);
           }
           setTargetText(cleanText);
        },
        (chunk) => setHinglishText(chunk)
      );
      
    } catch (error) {
      console.error(error);
      setTargetText("Error processing translation.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoAndTitle}>
          <View style={styles.logoContainer}>
            <Feather name="mic" size={24} color="white" />
          </View>
          <Text style={styles.headerTitle}>VoiceScript</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setIsDarkMode(!isDarkMode)} 
          style={styles.themeToggle}
        >
          <Feather name={isDarkMode ? "sun" : "moon"} size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* TABS */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'voice' && styles.activeTab]}
            onPress={() => setActiveTab('voice')}
          >
            <Feather name="mic" size={16} color={activeTab === 'voice' ? '#2563eb' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'voice' && styles.activeTabText]}>Voice</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'manual' && styles.activeTab]}
            onPress={() => setActiveTab('manual')}
          >
            <Feather name="type" size={16} color={activeTab === 'manual' ? '#2563eb' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* TAB CONTENT */}
        <View style={styles.contentArea}>
          
          {activeTab === 'voice' ? (
            <AudioRecorder 
              onTranscription={(text) => processText(text)}
              targetLangCode={targetLangCode}
              setTargetLangCode={setTargetLangCode}
              theme={theme}
            />
          ) : (
            <View style={styles.manualCard}>
              <Text style={styles.label}>Enter Text</Text>
              <TextInput 
                style={styles.input}
                placeholder="Type here to translate..."
                value={manualInput}
                onChangeText={setManualInput}
                multiline
              />
              <TouchableOpacity 
                style={styles.processBtn}
                onPress={() => processText(manualInput)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.processBtnText}>Translate</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* LOADING STATE */}
          {isProcessing && activeTab === 'voice' && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={theme.loader} />
              <Text style={styles.loaderText}>Processing...</Text>
            </View>
          )}

        </View>

        {/* RESULTS AREA */}
        {originalText ? (
          <View style={styles.resultsContainer}>
            
            {/* Original Text */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ORIGINAL</Text>
              <Text style={styles.cardText}>{originalText}</Text>
            </View>

            {/* Translation */}
            {targetText ? (
              <View style={[styles.card, styles.primaryCard]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardLabel, {color: '#2563eb'}]}>
                    TRANSLATION ({targetLangCode.toUpperCase()})
                  </Text>
                </View>
                <Text style={styles.cardTextBig}>{targetText}</Text>
              </View>
            ) : null}

            {/* Hinglish */}
            {hinglishText ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>PHONETIC (HINGLISH)</Text>
                <Text style={[styles.cardText, { fontStyle: 'italic', color: '#4b5563' }]}>
                  {hinglishText}
                </Text>
              </View>
            ) : null}

            {/* TTS Player */}
            <TextToSpeech 
              targetText={targetText}
              hinglishText={hinglishText}
              targetLanguage={targetLangCode}
              theme={theme}
            />

          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.cardBg,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  logoAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.background,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.tabBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: theme.cardBg,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeTabText: {
    color: theme.primary,
  },
  contentArea: {
    marginBottom: 24,
  },
  manualCard: {
    backgroundColor: theme.cardBg,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: theme.background,
    color: theme.text,
  },
  processBtn: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  processBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  loaderText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  resultsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  primaryCard: {
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primaryBg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cardText: {
    fontSize: 16,
    color: theme.text,
    lineHeight: 24,
  },
  cardTextBig: {
    fontSize: 18,
    color: theme.text,
    fontWeight: '500',
    lineHeight: 28,
  },
});