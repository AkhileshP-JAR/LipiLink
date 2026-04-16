import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import { Feather } from '@expo/vector-icons'; // Standard Icons
import { Theme } from '../utils/theme';

interface TextToSpeechProps {
  hinglishText?: string;
  targetText?: string;
  targetLanguage?: string; // e.g. 'hi', 'en', 'fr' or 'Hindi'
  theme: Theme;
}

export default function TextToSpeech({
  hinglishText,
  targetText,
  targetLanguage = 'hi',
  theme
}: TextToSpeechProps) {
  const styles = createStyles(theme);
  
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingHinglish, setIsPlayingHinglish] = useState(false);

  // Helper to map simple codes to TTS Locale codes
  const getLocale = (lang: string) => {
    // If we pass 'mr' (Marathi), some older Android TTS don't have 'mr-IN' installed.
    // However, Marathi is written in Devnagari script (like Hindi).
    // So if 'mr-IN' fails, 'hi-IN' (Hindi) can often read Devnagari text natively.
    const l = lang.toLowerCase();
    if (l === 'hi' || l.includes('hindi')) return 'hi-IN';
    if (l === 'mr' || l.includes('marathi')) return 'mr-IN'; 
    if (l === 'te' || l.includes('telugu')) return 'te-IN';
    if (l === 'ta' || l.includes('tamil')) return 'ta-IN';
    if (l === 'en' || l.includes('english')) return 'en-IN'; // Indian English
    if (l === 'ja' || l.includes('japanese')) return 'ja-JP';
    
    // Default fallback
    return 'en-US'; 
  };

  const speak = (text: string, langCode: string, setLocalPlayingState: (v: boolean) => void) => {
    Speech.stop();
    setIsPlayingTarget(false);
    setIsPlayingHinglish(false);

    setLocalPlayingState(true);
    
    // Function to actually call the Expo Speech API
    const attemptSpeech = (code: string) => {
      Speech.speak(text, {
        language: code,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setLocalPlayingState(false),
        onStopped: () => setLocalPlayingState(false),
        onError: (err) => {
          console.warn(`Speech failed for ${code}:`, err);
          
          // Fallback logic if specific Indian language voice is missing
          if (code === 'mr-IN') {
             console.log("Falling back from Marathi to Hindi for Devnagari script...");
             attemptSpeech('hi-IN');
          } else if (code === 'ta-IN' || code === 'te-IN') {
             // For Tamil/Telugu, Hindi TTS won't work well because the script is entirely different.
             // We fallback to Indian English, which often has phonetic rules built-in for Dravidian names.
             console.log(`Falling back from ${code} to en-IN...`);
             attemptSpeech('en-IN');
          } else {
             setLocalPlayingState(false);
          }
        },
      });
    };

    attemptSpeech(langCode);
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsPlayingTarget(false);
    setIsPlayingHinglish(false);
  };

  if (!hinglishText && !targetText) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="volume-2" size={20} color={theme.primary} />
        <Text style={styles.headerTitle}>Audio Playback</Text>
      </View>

      <View style={styles.content}>
        
        {/* 1. Target Language Playback */}
        {targetText ? (
          <View style={styles.row}>
            <Text style={styles.label}>
              {targetLanguage.toUpperCase()} (Native)
            </Text>
            
            <TouchableOpacity 
              style={[styles.button, isPlayingTarget ? styles.stopBtn : styles.playBtn]}
              onPress={() => {
                if (isPlayingTarget) stopSpeaking();
                else speak(targetText, getLocale(targetLanguage), setIsPlayingTarget);
              }}
            >
              <Feather 
                name={isPlayingTarget ? "square" : "play"} 
                size={16} 
                color={isPlayingTarget ? "#ef4444" : "#fff"} 
              />
              <Text style={[styles.btnText, isPlayingTarget && styles.stopBtnText]}>
                {isPlayingTarget ? "Stop" : `Play ${targetLanguage}`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 2. Hinglish Playback */}
        {hinglishText ? (
          <View style={styles.row}>
            <Text style={styles.label}>Hinglish (Phonetic)</Text>
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryBtn]}
              onPress={() => {
                if (isPlayingHinglish) stopSpeaking();
                else speak(hinglishText, 'en-US', setIsPlayingHinglish);
              }}
            >
              <Feather 
                name={isPlayingHinglish ? "square" : "play"} 
                size={16} 
                color="#4b5563" 
              />
              <Text style={styles.secondaryBtnText}>
                {isPlayingHinglish ? "Stop" : "Play Hinglish"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: theme.text,
  },
  content: {
    gap: 16,
  },
  row: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  playBtn: {
    backgroundColor: theme.primary, // Blue
  },
  stopBtn: {
    backgroundColor: theme.dangerBg, // Light Red
    borderWidth: 1,
    borderColor: theme.dangerBorder,
  },
  secondaryBtn: {
    backgroundColor: theme.tabBg, // Gray
    borderWidth: 1,
    borderColor: theme.border,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  stopBtnText: {
    color: theme.dangerText, // Red text
  },
  secondaryBtnText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 14,
  }
});