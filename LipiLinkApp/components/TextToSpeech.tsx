import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import { Feather } from '@expo/vector-icons'; // Standard Icons

interface TextToSpeechProps {
  hinglishText?: string;
  targetText?: string;
  targetLanguage?: string; // e.g. 'hi', 'en', 'fr' or 'Hindi'
}

export default function TextToSpeech({
  hinglishText,
  targetText,
  targetLanguage = 'hi'
}: TextToSpeechProps) {
  
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
        <Feather name="volume-2" size={20} color="#2563eb" />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#1f2937',
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
    color: '#4b5563',
    marginBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  playBtn: {
    backgroundColor: '#2563eb', // Blue
  },
  stopBtn: {
    backgroundColor: '#fee2e2', // Light Red
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  secondaryBtn: {
    backgroundColor: '#f3f4f6', // Gray
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  stopBtnText: {
    color: '#ef4444', // Red text
  },
  secondaryBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  }
});