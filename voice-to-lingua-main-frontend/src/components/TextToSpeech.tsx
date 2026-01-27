import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Play, Square, Volume2 } from 'lucide-react';

interface TextToSpeechProps {
  hinglishText: string;
  targetText: string;
  targetLanguage: string;
}

export const TextToSpeech: React.FC<TextToSpeechProps> = ({
  hinglishText,
  targetText,
  targetLanguage
}) => {
  const [isPlayingHinglish, setIsPlayingHinglish] = useState(false);
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [lastTtsError, setLastTtsError] = useState<string | null>(null);

  // speak(text, lang, setPlaying, fallback?)
  // fallback: { text, lang } - used if no voice is available for primary lang
  const speak = useCallback((text: string, lang: string, setPlaying: (playing: boolean) => void, fallback?: { text: string; lang: string }) => {
    if ('speechSynthesis' in window) {
      console.log(`[TTS] Speaking text: "${text}" with language: ${lang}`);
      
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Enhanced event handling with debug logging
      utterance.onstart = () => {
        console.log('[TTS] Speech started');
        setPlaying(true);
      };
      
      utterance.onend = () => {
        console.log('[TTS] Speech ended');
        setPlaying(false);
      };
      
      utterance.onerror = (event) => {
        console.error('[TTS] Speech error:', event.error);
        setPlaying(false);
      };
      
      utterance.onpause = () => {
        console.log('[TTS] Speech paused');
      };
      
      utterance.onresume = () => {
        console.log('[TTS] Speech resumed');
      };
      
      // Try to get available voices for better language support. Note: some
      // browsers populate voices asynchronously and getVoices() may return an
      // empty array at first. We handle that by waiting for the
      // 'voiceschanged' event for a short period before proceeding.
      const getVoicesAsync = (): Promise<SpeechSynthesisVoice[]> => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) return Promise.resolve(v);
        return new Promise((resolve) => {
          const handler = () => {
            const loaded = window.speechSynthesis.getVoices();
            if (loaded && loaded.length > 0) {
              window.speechSynthesis.removeEventListener('voiceschanged', handler);
              resolve(loaded);
            }
          };
          window.speechSynthesis.addEventListener('voiceschanged', handler);
          // Also resolve after a timeout with whatever voices we have (possibly empty)
          setTimeout(() => {
            window.speechSynthesis.removeEventListener('voiceschanged', handler);
            resolve(window.speechSynthesis.getVoices() || []);
          }, 1500);
        });
      };

      getVoicesAsync().then((voices) => {
        console.log('[TTS] Available voices:', voices.length);
        const langPrefix = lang.split('-')[0];
        // Find a voice that matches the language (prefer exact lang, then prefix)
        let preferredVoice = voices.find(voice => voice.lang === lang);
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang && voice.lang.startsWith(langPrefix));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log('[TTS] Using voice:', preferredVoice.name, preferredVoice.lang);
          try { 
            setLastTtsError(null);
            // mark playing optimistically; onstart/onend will update as well
            setPlaying(true);
            window.speechSynthesis.speak(utterance);
          }
          catch (err) { console.error('[TTS] speak() failed:', err); setPlaying(false); setLastTtsError(String(err)); }
          return;
        }

        // No preferred voice for requested language. If a fallback is provided
        // (for example, speak Hindi text using an English voice with Hinglish),
        // attempt to find a voice for the fallback language.
        if (fallback) {
          const fbLang = fallback.lang;
          const fbPrefix = fbLang.split('-')[0];
          let fbVoice = voices.find(v => v.lang === fbLang) || voices.find(v => v.lang && v.lang.startsWith(fbPrefix));
          if (fbVoice) {
            utterance.voice = fbVoice;
            utterance.lang = fbLang;
            utterance.text = fallback.text;
            console.log('[TTS] Falling back to voice:', fbVoice.name, fbVoice.lang, 'with fallback text');
            try { setLastTtsError(null); setPlaying(true); window.speechSynthesis.speak(utterance); }
            catch (err) { console.error('[TTS] speak() failed on fallback:', err); setPlaying(false); setLastTtsError(String(err)); }
            return;
          }
        }

        // No voice for primary or fallback languages — speak with default voice and lang hint
        console.log('[TTS] No preferred voice found for', lang, '- speaking with default voice and lang hint.');
        try { setLastTtsError(null); setPlaying(true); window.speechSynthesis.speak(utterance); }
        catch (err) { console.error('[TTS] speak() failed:', err); setPlaying(false); setLastTtsError(String(err)); }
      }).catch((e) => {
        console.warn('[TTS] getVoicesAsync failed', e);
        try { setLastTtsError(null); setPlaying(true); window.speechSynthesis.speak(utterance); } catch (err) { console.error(err); setPlaying(false); setLastTtsError(String(err)); }
      });
    } else {
      console.error('[TTS] Speech synthesis not supported');
      setLastTtsError('Speech synthesis not supported by this browser');
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlayingHinglish(false);
    setIsPlayingTarget(false);
    setLastTtsError(null);
  }, []);

  if (!hinglishText && !targetText) return null;

  return (
    <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Text to Speech
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hinglishText && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Hinglish</p>
            <Button
              onClick={() => {
                if (isPlayingHinglish) {
                  stopSpeaking();
                } else {
                  // Use an English voice for Hinglish (latin script) for better pronunciation
                  speak(hinglishText, 'en-US', setIsPlayingHinglish);
                }
              }}
              variant={isPlayingHinglish ? "recording" : "gradient"}
              className="w-full"
            >
              {isPlayingHinglish ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Play Hinglish
                </>
              )}
            </Button>
          </div>
        )}

        {targetText && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{targetLanguage}</p>
            <Button
              onClick={() => {
                if (isPlayingTarget) {
                  stopSpeaking();
                } else {
                  // Choose lang code based on targetLanguage prop
                  const langCode = targetLanguage === 'Hindi' ? 'hi-IN' : 'en-US';
                  if (langCode === 'hi-IN') {
                    // If no hi-IN voice exists, fallback to speaking the Hinglish (latin) text
                    speak(targetText, 'hi-IN', setIsPlayingTarget, { text: hinglishText || targetText, lang: 'en-US' });
                  } else {
                    speak(targetText, langCode, setIsPlayingTarget);
                  }
                }
              }}
              variant={isPlayingTarget ? "recording" : "gradient"}
              className="w-full"
            >
              {isPlayingTarget ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Play {targetLanguage}
                </>
              )}
            </Button>
            {lastTtsError && (
              <p className="text-xs text-red-600 mt-2">TTS error: {lastTtsError}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};