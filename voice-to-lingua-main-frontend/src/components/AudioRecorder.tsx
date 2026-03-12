import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle, Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button'; 
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AudioRecorderProps {
  onTranscription?: (text: string) => void;
  onProcessing?: (loading: boolean) => void;
  
  // NEW: Props to control Target Language from parent
  targetLangCode: string;
  setTargetLangCode: (code: string) => void;

  // Legacy props kept for compatibility
  translatedText?: string;
  hinglishText?: string;
  targetLanguage?: string;
  originalText?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onTranscription, 
  onProcessing,
  targetLangCode,
  setTargetLangCode
}) => {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputLanguage, setInputLanguage] = useState<string>('auto'); 
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setIsLoading(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/mp4';

      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        setIsLoading(true);
        onProcessing?.(true);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleUpload(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err: any) {
      setError('Microphone access denied or not available.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    } catch (err: any) {
      setError('Error stopping recording');
    }
  };

  const handleUpload = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    
    // Pass the selected INPUT language to the backend (for transcription accuracy)
    formData.append('language', inputLanguage);

    // Contextual prompts based on input selection
    if (inputLanguage === 'hi') {
      formData.append('prompt', "This is a Hindi conversation. Transcribe accurately in Devanagari.");
    } else if (inputLanguage === 'mr') {
      formData.append('prompt', "This is a Marathi conversation. Transcribe accurately.");
    } else if (inputLanguage === 'auto') {
      formData.append('prompt', "Start of transcript. This is a clear audio recording.");
    }

    try {
      const res = await fetch('http://localhost:8097/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const text = data.transcript || data.text || '';
      
      onTranscription?.(text);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Failed to transcribe. Is the backend running?');
    } finally {
      setIsLoading(false);
      onProcessing?.(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-6">
      
      {/* Dual Language Selectors */}
      <div className="grid grid-cols-2 gap-3 w-full">
        
        {/* 1. Input Language Selector */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground ml-1">I am speaking...</label>
          <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border/50">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <select 
              className="bg-transparent text-sm focus:outline-none cursor-pointer text-foreground w-full"
              value={inputLanguage}
              onChange={(e) => setInputLanguage(e.target.value)}
            >
              <option value="auto">Auto-Detect</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
              <option value="gu">Gujarati</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="kn">Kannada</option>
              <option value="ml">Malayalam</option>
              <option value="bn">Bengali</option>
              <option value="pa">Punjabi</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
        </div>

        {/* 2. Target Language Selector */}
        <div className="space-y-1">
          <label className="text-xs text-primary/80 font-medium ml-1">Translate to...</label>
          <div className="flex items-center gap-2 bg-primary/10 p-2 rounded-lg border border-primary/20">
            <ArrowRight className="w-4 h-4 text-primary shrink-0" />
            <select 
              className="bg-transparent text-sm focus:outline-none cursor-pointer text-foreground w-full font-medium"
              value={targetLangCode}
              onChange={(e) => setTargetLangCode(e.target.value)}
            >
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="en">English (English)</option>
              <option value="mr">Marathi (मराठी)</option>
              <option value="fr">French (Français)</option>
              <option value="es">Spanish (Español)</option>
              <option value="de">German (Deutsch)</option>
              <option value="ja">Japanese (日本語)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="relative">
        {recording && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
        )}
        
        <Button
          onClick={recording ? stopRecording : startRecording}
          disabled={isLoading}
          variant={recording ? "destructive" : "default"}
          className={`h-24 w-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
            recording ? 'scale-110 shadow-lg shadow-red-500/50' : 'shadow-lg shadow-primary/30'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : recording ? (
            <>
              <Square className="h-8 w-8 mb-1 fill-current" />
              <span className="text-xs font-bold uppercase tracking-wider">Stop</span>
            </>
          ) : (
            <>
              <Mic className="h-8 w-8 mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider">Rec</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground text-center">
        {recording ? "Listening..." : "Tap to speak"}
      </p>
    </div>
  );
};