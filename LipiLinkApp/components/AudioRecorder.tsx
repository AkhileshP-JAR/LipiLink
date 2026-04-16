import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Picker } from '@react-native-picker/picker'; // Mobile Dropdown
import { Feather, MaterialIcons } from '@expo/vector-icons'; // Standard Icons for Expo
import { SUPPORTED_LANGUAGES, LanguageCode } from '../constants/languages';
import { Theme } from '../utils/theme';

// ⚠️ IMPORTANT: Replace with your PC's IP Address (e.g., 192.168.1.5)
const BACKEND_URL = 'http://192.168.33.69:8097';

// const BACKEND_URL = 'http://192.168.0.105:8097';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  targetLangCode: string;
  setTargetLangCode: (code: string) => void;
  theme: Theme;
}

export default function AudioRecorder({
  onTranscription,
  targetLangCode,
  setTargetLangCode,
  theme
}: AudioRecorderProps) {
  const styles = createStyles(theme);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputLanguage, setInputLanguage] = useState<string>('hi');
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  const swapLanguages = () => {
    const temp = inputLanguage;
    setInputLanguage(targetLangCode);
    setTargetLangCode(temp);
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  async function startRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        const resp = await requestPermission();
        if (resp.status !== 'granted') return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording');
      console.error(err);
    }
  }

  async function stopRecording() {
    setIsRecording(false);
    setIsLoading(true);

    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await uploadAudio(uri);
      }
    } catch (error) {
      console.error(error);
    }
  }

  const uploadAudio = async (uri: string) => {
    try {
      const formData = new FormData();

      // Native File Object for FormData
      const filePayload = {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      };

      // @ts-ignore
      formData.append('file', filePayload);

      // 1. Pass Input Language
      formData.append('language', inputLanguage);

      // 2. Add Context Prompts (Logic ported from your Web App)
      if (inputLanguage === 'hi') {
        formData.append('prompt', "This is a Hindi conversation. Transcribe accurately in Devanagari.");
      } else if (inputLanguage === 'mr') {
        formData.append('prompt', "This is a Marathi conversation. Transcribe accurately.");
      } else if (inputLanguage === 'auto') {
        formData.append('prompt', "Start of transcript. This is a clear audio recording.");
      }

      const response = await fetch(`${BACKEND_URL}/transcribe/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) throw new Error('Server Error');

      const data = await response.json();
      const text = data.transcript || "";
      onTranscription(text);

    } catch (error) {
      Alert.alert("Upload Failed", "Is the backend running? Check IP address.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* --- Language Selectors --- */}
      <View style={styles.selectorsContainer}>

        {/* Input Language */}
        <View style={styles.selectorBox}>
          <View style={styles.labelRow}>
            <Feather name="globe" size={12} color={theme.textSecondary} />
            <Text style={styles.labelText}>Input</Text>
          </View>
          <Picker
            selectedValue={inputLanguage}
            onValueChange={(itemValue: string) => setInputLanguage(itemValue)}
            style={styles.picker}
            itemStyle={{ fontSize: 14 }} // iOS font size
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Picker.Item key={`in-${lang.code}`} label={lang.name} value={lang.code} />
            ))}
          </Picker>
        </View>

        {/* Swap Button */}
        <TouchableOpacity style={styles.swapButton} onPress={swapLanguages}>
          <MaterialIcons name="swap-horiz" size={24} color={theme.primary} />
        </TouchableOpacity>

        {/* Target Language */}
        <View style={[styles.selectorBox, styles.targetBox]}>
          <View style={styles.labelRow}>
            <Feather name="arrow-right" size={12} color={theme.primary} />
            <Text style={[styles.labelText, { color: theme.primary }]}>Target</Text>
          </View>
          <Picker
            selectedValue={targetLangCode}
            onValueChange={(itemValue: string) => setTargetLangCode(itemValue)}
            style={styles.picker}
            itemStyle={{ fontSize: 14 }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Picker.Item key={`out-${lang.code}`} label={lang.name} value={lang.code} />
            ))}
          </Picker>
        </View>

      </View>

      {/* --- Recording Button --- */}
      <View style={styles.recordContainer}>
        {isRecording && (
          // Simple Pulse Animation Placeholder (View ring)
          <View style={styles.pulseRing} />
        )}

        <TouchableOpacity
          style={[styles.button, isRecording ? styles.recordingBtn : styles.defaultBtn]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Feather
                name={isRecording ? "square" : "mic"}
                size={32}
                color="white"
              />
              <Text style={styles.btnText}>
                {isRecording ? "Stop" : "Rec"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.statusText}>
        {isRecording ? "Listening..." : "Tap to Speak"}
      </Text>

    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  selectorsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 10,
  },
  selectorBox: {
    flex: 1,
    backgroundColor: theme.tabBg, // muted/40
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden', // Ensures picker stays inside border
  },
  targetBox: {
    backgroundColor: theme.primaryBg, // primary/10
    borderColor: theme.primaryBorder,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  labelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  picker: {
    width: '100%',
    height: 48, // Height for Android
    marginTop: -4, // Pull picker up closer to label
    color: theme.text,
  },
  swapButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    backgroundColor: theme.primaryBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  recordContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    zIndex: 2,
  },
  defaultBtn: {
    backgroundColor: theme.primary, // Blue
  },
  recordingBtn: {
    backgroundColor: theme.dangerText, // Red
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  statusText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.dangerBg, // Red opacity
    zIndex: 1,
  },
});