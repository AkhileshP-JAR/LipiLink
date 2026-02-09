import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Simple logic without the complex dropdown for now
  const speak = useCallback((text: string, lang: string, setPlaying: (playing: boolean) => void) => {
    if (!('speechSynthesis' in window)) {
      setLastTtsError('Speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; 

    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = (event) => {
      console.error('[TTS] Error:', event);
      setPlaying(false);
    };

    // Auto-select best voice without dropdown
    const voices = window.speechSynthesis.getVoices();
    const prefix = lang.split('-')[0];
    const preferredVoice = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(prefix));
    
    if (preferredVoice) utterance.voice = preferredVoice;

    try { 
      setLastTtsError(null);
      setPlaying(true);
      window.speechSynthesis.speak(utterance);
    } catch (err) { 
      setPlaying(false); 
      setLastTtsError(String(err)); 
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlayingHinglish(false);
    setIsPlayingTarget(false);
  }, []);

  // Ensure voices are loaded
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  if (!hinglishText && !targetText) return null;

  return (
    <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50 backdrop-blur-sm shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Volume2 className="w-5 h-5 text-primary" />
          Audio Playback
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {targetText && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{targetLanguage} (Native Script)</p>
              <Button
                onClick={() => {
                  if (isPlayingTarget) stopSpeaking();
                  else {
                    // Simple logic: Try Hindi, fallback to Hinglish
                    const langCode = targetLanguage === 'Hindi' ? 'hi-IN' : 'en-US';
                    speak(targetText, langCode, setIsPlayingTarget);
                  }
                }}
                variant={isPlayingTarget ? "destructive" : "default"}
                className="w-full shadow-sm"
              >
                {isPlayingTarget ? (
                  <><Square className="w-4 h-4 mr-2" /> Stop</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Play {targetLanguage}</>
                )}
              </Button>
            </div>
          )}

          {hinglishText && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Hinglish (Phonetic)</p>
              <Button
                onClick={() => {
                  if (isPlayingHinglish) stopSpeaking();
                  else speak(hinglishText, 'en-US', setIsPlayingHinglish);
                }}
                variant={isPlayingHinglish ? "destructive" : "secondary"}
                className="w-full shadow-sm border"
              >
                {isPlayingHinglish ? (
                  <><Square className="w-4 h-4 mr-2" /> Stop</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Play Hinglish</>
                )}
              </Button>
            </div>
          )}

          {lastTtsError && (
            <p className="text-xs text-red-600 mt-2 text-center bg-red-50 p-2 rounded">
              TTS error: {lastTtsError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};