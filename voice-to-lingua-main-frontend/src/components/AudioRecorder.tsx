import React, { useState, useRef, useEffect } from 'react';

interface AudioRecorderProps {
  onTranscription?: (text: string) => void;
  onProcessing?: (loading: boolean) => void;
  translatedText?: string;
  hinglishText?: string;
  targetLanguage?: string;
  originalText?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscription, onProcessing, translatedText, hinglishText, targetLanguage, originalText }) => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [voicesList, setVoicesList] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(() => {
    try { return localStorage.getItem('vtl_tts_voice'); } catch { return null; }
  });
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

  // no-op: intentionally left blank; we call onProcessing at start/end of upload

  const startRecording = async () => {
    setError(null);
    setTranscript('');
    setIsLoading(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
  setIsLoading(true);
  try { onProcessing?.(true); } catch {}
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert webm to wav on the server (Whisper accepts many formats via ffmpeg)
        try {
          // Quick connectivity/CORS check before uploading
          try {
            const probe = await fetch('http://localhost:8000/openapi.json', { method: 'GET' });
            if (!probe.ok) {
              setError(`Transcription server reachable but returned ${probe.status}. Check server logs.`);
              console.error('Backend probe failed:', probe.status, await probe.text());
              setIsLoading(false);
              try { onProcessing?.(false); } catch {}
              return;
            }
          } catch (probeErr: any) {
            console.error('Backend probe error:', probeErr);
            setError('Cannot reach transcription server. Possible causes: backend not running, CORS blocked, or mixed-content (HTTP vs HTTPS).');
            setIsLoading(false);
            try { onProcessing?.(false); } catch {}
            return;
          }

          const form = new FormData();
          // Use filename so backend can detect format if needed
          form.append('file', blob, 'recording.webm');
          let res: Response;
          try {
            res = await fetch('http://localhost:8000/transcribe/', {
              method: 'POST',
              body: form,
            });
          } catch (networkErr: any) {
            console.error('Upload fetch error:', networkErr);
            setError('Upload/transcription failed: network error (check backend, CORS, mixed-content).');
            setIsLoading(false);
            try { onProcessing?.(false); } catch {}
            return;
          }

          if (!res.ok) {
            const text = await res.text();
            setError(`Transcription failed: ${res.status} ${text}`);
            console.error('Transcription failed response:', res.status, text);
            setIsLoading(false);
            return;
          }

          // Parse json safely
          let data: any = null;
          try {
            data = await res.json();
          } catch (jsonErr: any) {
            console.error('Failed to parse JSON from transcription response:', jsonErr);
            setError('Transcription succeeded but response was malformed. See console for details.');
            setIsLoading(false);
            return;
          }

          const text = (data && (data.transcript || data.text)) || '';
          setTranscript(text);
          onTranscription?.(text);
          setIsLoading(false);
          try { onProcessing?.(false); } catch {}
        } catch (err: any) {
          console.error('Upload/transcription error:', err);
          setError('Upload/transcription error: ' + (err?.message || String(err)));
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err: any) {
      setError('Microphone error: ' + (err.message || err));
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
      setError('Stop error: ' + (err.message || err));
    }
  };

  const speak = () => {
    // Prefer speaking the translated text if available; fall back to hinglish, originalText, or transcript
    const textToSpeak = (translatedText && translatedText.trim()) ? translatedText : (hinglishText && hinglishText.trim()) ? hinglishText : ((originalText && originalText.trim()) ? originalText : transcript);
    if (!textToSpeak) {
      setError('Nothing to speak');
      return;
    }
    console.log('[AudioRecorder] speak() textToSpeak:', textToSpeak.slice(0, 200));

    const langCode = targetLanguage === 'Hindi' ? 'hi-IN' : 'en-US';

    if (!('speechSynthesis' in window)) {
      setError('Speech synthesis not supported in this browser');
      return;
    }

    const utter = new window.SpeechSynthesisUtterance(textToSpeak);
    utter.lang = langCode;

    utter.onstart = () => { console.log('[AudioRecorder TTS] start'); };
    utter.onend = () => { console.log('[AudioRecorder TTS] end'); };
    utter.onerror = (ev) => { console.error('[AudioRecorder TTS] error', ev); setError('TTS error: ' + (ev?.error || 'unknown')); };

    // helper to wait for voices to be populated
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
        setTimeout(() => {
          window.speechSynthesis.removeEventListener('voiceschanged', handler);
          resolve(window.speechSynthesis.getVoices() || []);
        }, 1200);
      });
    };

    getVoicesAsync().then((voices) => {
      console.log('[AudioRecorder TTS] voices', voices.length, voices.map(v=>v.lang + '|' + v.name));
  try { setVoicesList(voices.map(v => ({ id: `${v.lang}__${v.name}`, label: `${v.lang} — ${v.name}` }))); } catch(e){}
      const prefix = langCode.split('-')[0];
      let v = voices.find(voice => voice.lang === langCode) || voices.find(voice => voice.lang && voice.lang.startsWith(prefix));
      if (v) {
        utter.voice = v;
        console.log('[AudioRecorder TTS] using voice', v.name, v.lang);
      } else {
        console.log('[AudioRecorder TTS] no matching voice found for', langCode, 'using default');
      }

      try {
        // If user selected a preferred voice, try to use it
        if (selectedVoiceId) {
          const vs = window.speechSynthesis.getVoices() || [];
          const preferred = vs.find(v => `${v.lang}__${v.name}` === selectedVoiceId);
          if (preferred) {
            utter.voice = preferred;
            console.log('[AudioRecorder TTS] using preferred voice', preferred.name, preferred.lang);
          }
        }
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch (err: any) {
        console.error('[AudioRecorder TTS] speak failed', err);
        setError('TTS speak failed: ' + (err?.message || String(err)));
      }
    }).catch((e) => {
      console.warn('[AudioRecorder TTS] getVoices failed', e);
      try { window.speechSynthesis.speak(utter); } catch (err: any) { setError('TTS speak failed: ' + (err?.message || String(err))); }
    });
  };

  return (
    <div style={{ maxWidth: 520, margin: '2rem auto', padding: 24, background: '#f8f6ff', borderRadius: 12, textAlign: 'center' }}>
      <button
        onClick={recording ? stopRecording : startRecording}
        disabled={isLoading}
        style={{
          background: recording ? '#ff4d6d' : '#6c47ff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: 84,
          height: 84,
          fontSize: 28,
          marginBottom: 16,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? '⏳' : (recording ? '■' : '🎤')}
      </button>
      {error && <div style={{ color: 'red', margin: '8px 0' }}>{error}</div>}
      {isLoading && <div style={{ color: '#333', margin: '8px 0' }}>Processing… uploading audio and awaiting transcription...</div>}
      <div style={{ margin: '12px 0', textAlign: 'left' }}>
        <div><strong>Transcript:</strong></div>
        <div style={{ background: '#fff', padding: 8, borderRadius: 6, minHeight: 40 }}>{(originalText && originalText.trim()) ? originalText : (transcript || <span style={{ color: '#999' }}>No transcript yet</span>)}</div>
      </div>

      {hinglishText !== undefined && (
        <div style={{ margin: '12px 0', textAlign: 'left' }}>
          <div><strong>Hinglish:</strong></div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 6, minHeight: 40 }}>{hinglishText || <span style={{ color: '#999' }}>No hinglish yet</span>}</div>
        </div>
      )}

      {translatedText !== undefined && (
        <div style={{ margin: '12px 0', textAlign: 'left' }}>
          <div><strong>Translation ({targetLanguage || 'Target'}):</strong></div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 6, minHeight: 40 }}>{translatedText || <span style={{ color: '#999' }}>No translation yet</span>}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button onClick={speak} disabled={!( (translatedText && translatedText.trim()) || (hinglishText && hinglishText.trim()) || (originalText && originalText.trim()) || (transcript && transcript.trim()) )} style={{ padding: '8px 16px', borderRadius: 8, background: '#6c47ff', color: 'white', border: 'none', cursor: 'pointer' }}>
            Speak Translation
          </button>
        </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        <button onClick={() => {
          setError(null);
          try {
            const vs = (window.speechSynthesis.getVoices() || []).map(v => ({ id: `${v.lang}__${v.name}`, label: `${v.lang} — ${v.name}` }));
            setVoicesList(vs.length ? vs : []);
          } catch (e) { setError('Failed to load voices: ' + (((e as any)?.message) || String(e))); }
        }} style={{ padding: '6px 12px', borderRadius: 8, background: '#eee', border: '1px solid #ddd' }}>{voicesList.length ? 'Hide voices' : 'Show voices'}</button>
      </div>
      {voicesList.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>Preferred voice:</label>
          <select value={selectedVoiceId || ''} onChange={(e) => { const v = e.target.value || null; setSelectedVoiceId(v); try { if (v) localStorage.setItem('vtl_tts_voice', v); else localStorage.removeItem('vtl_tts_voice'); } catch {} }} style={{ padding: '6px 8px', borderRadius: 6 }}>
            <option value="">Default</option>
            {voicesList.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
      )}
      {voicesList.length > 0 && (
        <div style={{ marginTop: 8, textAlign: 'left', maxHeight: 160, overflow: 'auto', background: '#fff', padding: 8, borderRadius: 6 }}>
          <strong>Available voices</strong>
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            {voicesList.map((v,i) => <li key={i} style={{ fontSize: 13 }}>{v.label}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};