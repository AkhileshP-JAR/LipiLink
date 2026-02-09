import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Adjust path if needed
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AudioRecorderProps {
  onTranscription?: (text: string) => void;
  onProcessing?: (loading: boolean) => void;
  // These props are kept for interface compatibility but ignored
  translatedText?: string;
  hinglishText?: string;
  targetLanguage?: string;
  originalText?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onTranscription, 
  onProcessing
}) => {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
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

    try {
      // Ensure port matches your backend (8097)
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
      setError('Failed to transcribe audio. Is the backend running?');
    } finally {
      setIsLoading(false);
      onProcessing?.(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-6">
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