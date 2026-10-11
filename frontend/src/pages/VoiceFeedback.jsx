import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Radio,
  Send,
  MessageSquare,
  Loader2,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const BACKEND_URL = "http://localhost:8000";

export default function VoiceFeedback() {
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  // Audio & transcription
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sentiment, setSentiment] = useState('Neutral');
  const [tone, setTone] = useState('Constructive');
  const [confidence, setConfidence] = useState('95%');
  const [summary, setSummary] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // History of saved voice feedback
  const [savedHistory, setSavedHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: formsData } = await supabase
        .from('feedback_forms')
        .select('id');
      const formIds = (formsData || []).map(f => f.id);
      if (formIds.length === 0) {
        setSavedHistory([]);
        setLoadingHistory(false);
        return;
      }
      const { data } = await supabase
        .from('voice_feedback')
        .select('*')
        .in('form_id', formIds)
        .order('created_at', { ascending: false })
        .limit(10);
      setSavedHistory(data || []);
    } catch (e) {
      console.error('History load error:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleStartRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setTimer(0);
      setHasRecorded(false);
      setSaved(false);
      setErrorMsg(null);
    } catch (e) {
      console.error('Microphone access error:', e);
      setErrorMsg('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setHasRecorded(true);
  };

  const handleReset = () => {
    setIsRecording(false);
    setHasRecorded(false);
    setTimer(0);
    setAudioBlob(null);
    setAudioUrl('');
    setTranscript('');
    setSentiment('Neutral');
    setTone('Constructive');
    setConfidence('95%');
    setSummary('');
    setSuggestions([]);
    setSaved(false);
    setErrorMsg(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePlay = () => {
    if (!audioUrl) return;
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
      audioRef.current.onended = () => setIsPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice-feedback.webm');

      const res = await fetch(`${BACKEND_URL}/transcribe-audio`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'success') {
        setTranscript(data.transcript);
        setSentiment(data.sentiment || 'Neutral');
        setTone(data.tone || 'Constructive');
        setConfidence(data.confidence || '95%');
        setSummary(data.summary || '');
        setSuggestions(data.suggestions || []);
      } else {
        setErrorMsg(data.detail || 'Transcription failed.');
      }
    } catch (e) {
      console.error('Transcription error:', e);
      setErrorMsg('Failed to connect to backend. Make sure the server is running on port 8000.');
    } finally {
      setTranscribing(false);
    }
  };

  const saveToSupabase = async () => {
    if (!transcript) return;
    setSaving(true);
    try {
      // Find the first form to associate voice feedback, or create a placeholder
      const { data: formsData } = await supabase
        .from('feedback_forms')
        .select('id')
        .limit(1);

      let formId = formsData && formsData.length > 0 ? formsData[0].id : null;

      // If no form exists, create a simple voice feedback form
      if (!formId) {
        const { data: newForm } = await supabase
          .from('feedback_forms')
          .insert([{
            title: 'Voice Feedback Collection',
            description: 'Collected voice feedback responses',
            questions: [],
            status: 'Active',
            default_language: 'en'
          }])
          .select();
        formId = newForm[0].id;
      }

      const { error } = await supabase
        .from('voice_feedback')
        .insert([{
          form_id: formId,
          transcript: transcript,
          sentiment: sentiment,
          tone: tone,
          confidence: confidence,
          respondent_language: 'en'
        }]);

      if (error) throw error;

      setSaved(true);
      loadHistory();
    } catch (e) {
      console.error('Save error:', e);
      setErrorMsg('Failed to save to database.');
    } finally {
      setSaving(false);
    }
  };

  const togglePlayHistory = (id) => {
    setPlayingId(playingId === id ? null : id);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #311b92 50%, #4c1d95 100%)',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2rem',
        borderRadius: 'var(--radius-xl)'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.12)', padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Radio size={14} color="#06b6d4" />
            <span>ElevenLabs Voice AI Ready</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            Voice Feedback Recorder
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', maxWidth: '560px' }}>
            Capture rich, emotional audio responses from your users. Automated transcript conversion & sentiment extraction enabled.
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'right', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#a5b4fc', fontWeight: '700' }}>Voice Quality</span>
          <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.2rem' }}>HD Audio 48kHz</h4>
        </div>
      </div>

      {/* Main Interactive Recorder Box */}
      <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>

        <span className="badge badge-purple" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
          Voice Feedback Recorder
        </span>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fee2e2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        {/* Pulsing Audio Ring */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className={isRecording ? 'pulse-glow' : ''} style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: isRecording
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: isRecording ? '0 0 30px rgba(239, 68, 68, 0.5)' : 'var(--shadow-purple)',
            transition: 'all 0.3s ease'
          }}>
            <Mic size={48} />
          </div>
        </div>

        {/* Timer Display */}
        <div>
          <h3 style={{ fontSize: '2.5rem', fontWeight: '800', fontFamily: 'monospace', color: 'var(--text-main)' }}>
            {formatTime(timer)}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {isRecording ? 'Recording in progress...' : hasRecorded ? 'Recording complete' : 'Tap the microphone to start'}
          </p>
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {!isRecording ? (
            <button onClick={handleStartRecord} className="btn-primary" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Mic size={18} />
              <span>{hasRecorded ? 'Re-record' : 'Start Recording'}</span>
            </button>
          ) : (
            <button onClick={handleStopRecord} className="btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <Square size={18} />
              <span>Stop</span>
            </button>
          )}

          {hasRecorded && audioUrl && !isRecording && (
            <>
              {!isPlaying ? (
                <button onClick={handlePlay} className="btn-secondary">
                  <Play size={16} />
                  Play
                </button>
              ) : (
                <button onClick={handlePause} className="btn-secondary">
                  <Pause size={16} />
                  Pause
                </button>
              )}
              <button onClick={handleReset} className="btn-secondary">
                <RotateCcw size={16} />
                Reset
              </button>
            </>
          )}
        </div>

        {/* Transcribe button */}
        {hasRecorded && !isRecording && (
          <button onClick={transcribeAudio} disabled={transcribing} className="btn-secondary" style={{ marginTop: '0.5rem' }}>
            {transcribing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {transcribing ? 'Transcribing with AI...' : 'Transcribe & Analyze'}
          </button>
        )}
      </div>

      {/* Transcript & Analysis Results */}
      {transcript && (
        <div className="grid-2">
          {/* Transcript Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Transcript</h3>
              </div>
              <button onClick={saveToSupabase} disabled={saving || saved} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                {saved ? <CheckCircle2 size={14} color="var(--accent-green)" /> : saving ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Supabase'}
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '0.925rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                {transcript}
              </p>
            </div>

            {summary && (
              <div style={{ background: 'var(--primary-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                <strong>Summary: </strong>{summary}
              </div>
            )}
          </div>

          {/* Sentiment & Suggestions Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="#8b5cf6" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>AI Sentiment Analysis</h3>
            </div>

            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Sentiment</p>
                <p style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '0.25rem', color: sentiment === 'Positive' ? 'var(--accent-green)' : sentiment === 'Friction' || sentiment === 'Negative' ? 'var(--accent-red)' : 'var(--accent-amber)' }}>
                  {sentiment}
                </p>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Tone</p>
                <p style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '0.25rem' }}>{tone}</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Confidence</p>
                <p style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--primary)' }}>{confidence}</p>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>AI Suggestions:</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {suggestions.map((s, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--primary)' }}>•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Voice Feedback History */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Database size={20} color="var(--primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Saved Voice Feedback</h3>
          {loadingHistory && <Loader2 size={16} className="animate-spin" color="var(--primary)" />}
        </div>

        {savedHistory.length === 0 && !loadingHistory ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>
            No saved voice feedback yet. Record and save some to see it here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {savedHistory.map((item) => (
              <div key={item.id} style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className={`badge ${item.sentiment === 'Positive' ? 'badge-green' : item.sentiment === 'Friction' || item.sentiment === 'Negative' ? 'badge-red' : 'badge-amber'}`}>
                    {item.sentiment || 'Neutral'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                  {item.transcript}
                </p>
                {item.tone && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tone: {item.tone}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
