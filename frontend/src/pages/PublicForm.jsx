import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Sparkles, Send, Globe, QrCode, Mic } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';

const BACKEND_URL = "http://localhost:8000";

const LANGUAGES = {
  en: { label: 'English', code: 'en' },
  te: { label: 'తెలుగు', code: 'te' },
  hi: { label: 'हिन्दी', code: 'hi' }
};

const UI_STRINGS = {
  en: { submit: 'Submit Feedback', loading: 'Submitting...', success: 'Thank you! Your feedback has been received.', title: 'Feedback Form', followUp: 'Follow-up question', addVoice: 'Add Voice Feedback' },
  te: { submit: 'ఫీడ్‌బ్యాక్ సమర్పించండి', loading: 'సమర్పిస్తోంది...', success: 'ధన్యవాదాలు! మీ ఫీడ్‌బ్యాక్ స్వీకరించబడింది.', title: 'ఫీడ్‌బ్యాక్ ఫాం', followUp: 'అనుసరణ ప్రశ్న', addVoice: 'వాయిస్ ఫీడ్‌బ్యాక్ జోడించండి' },
  hi: { submit: 'प्रतिक्रिया जमा करें', loading: 'जमा हो रहा है...', success: 'धन्यवाद! आपकी प्रतिक्रिया प्राप्त हो गई है।', title: 'प्रतिक्रिया फॉर्म', followUp: 'फॉलो-अप प्रश्न', addVoice: 'वॉइस प्रतिक्रिया जोड़ें' }
};

export default function PublicForm() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [answers, setAnswers] = useState({});
  const [language, setLanguage] = useState('en');
  const [translatedQuestions, setTranslatedQuestions] = useState({});
  const [followUps, setFollowUps] = useState({});
  const [followUpAnswers, setFollowUpAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [overallRating, setOverallRating] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Voice feedback
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceSentiment, setVoiceSentiment] = useState('Neutral');
  const [voiceSuggestions, setVoiceSuggestions] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const { data, error } = await supabase
          .from('feedback_forms')
          .select('id, title, description, questions, default_language, translations')
          .eq('id', formId)
          .single();

        if (error) throw error;
        setForm(data);
      } catch (err) {
        console.error('Public form fetch failed:', err);
        setLoadError(`Form could not be loaded: ${err?.message || 'Unknown Supabase error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  // Generate QR code for this form's public URL
  useEffect(() => {
    if (formId) {
      const publicUrl = `${window.location.origin}/form/${formId}`;
      QRCode.toDataURL(publicUrl, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [formId]);

  // Translate questions when language changes
  useEffect(() => {
    if (!form || language === form.default_language) {
      setTranslatedQuestions({});
      return;
    }

    const translateQuestions = async () => {
      const questions = form.questions || [];
      const translations = {};

      for (const q of questions) {
        try {
          const res = await fetch(`${BACKEND_URL}/translate-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: q.question, target_language: language })
          });
          const data = await res.json();
          if (data.translated) {
            translations[q.id] = data.translated;
          }
        } catch (e) {
          console.error('Translation error:', e);
        }
      }

      setTranslatedQuestions(translations);
    };

    translateQuestions();
  }, [form, language]);

  const getQuestionText = (q) => translatedQuestions[q.id] || q.question;

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    // Check if we should generate a follow-up question for text answers
    const question = form?.questions?.find(q => q.id === questionId);
    if (question && question.type === 'text' && value && value.trim().length > 0) {
      const wordCount = value.trim().split(/\s+/).length;
      if (wordCount < 6) {
        generateFollowUp(questionId, question.question, value);
      }
    }
  };

  const generateFollowUp = async (questionId, questionText, answerText) => {
    try {
      const res = await fetch(`${BACKEND_URL}/generate-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: questionText, answer_text: answerText })
      });
      const data = await res.json();
      if (data.follow_up) {
        setFollowUps(prev => ({ ...prev, [questionId]: data.follow_up }));
      } else {
        setFollowUps(prev => {
          const updated = { ...prev };
          delete updated[questionId];
          return updated;
        });
      }
    } catch (e) {
      console.error('Follow-up generation error:', e);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Recording error:', e);
      alert('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice-feedback.webm');

      const res = await fetch(`${BACKEND_URL}/transcribe-audio`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setVoiceTranscript(data.transcript);
        setVoiceSentiment(data.sentiment);
        setVoiceSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Transcription error:', e);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const ratingValue = overallRating || (() => {
        const ratingQ = form?.questions?.find(q => q.type === 'rating');
        return ratingQ ? Number(answers[ratingQ.id]) : null;
      })();

      const { error: responseError } = await supabase.from('feedback_responses').insert([{
        form_id: formId,
        answers: answers,
        rating: ratingValue,
        sentiment: voiceSentiment || 'Neutral',
        respondent_language: language,
        follow_up_answers: followUpAnswers,
        respondent_name: null
      }]);
      if (responseError) throw responseError;

      if (voiceTranscript && voiceTranscript.length > 0) {
        const { error: voiceError } = await supabase.from('voice_feedback').insert([{
          form_id: formId,
          transcript: voiceTranscript,
          sentiment: voiceSentiment,
          tone: null,
          confidence: null,
          respondent_language: language,
        }]);
        if (voiceError) throw voiceError;
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Feedback submission failed:', err);
      const details = [
        err?.code && `Code: ${err.code}`,
        err?.message || String(err),
        err?.details && `Details: ${err.details}`,
        err?.hint && `Hint: ${err.hint}`,
      ].filter(Boolean).join(' ');
      setSubmitError(`Failed to submit feedback. ${details}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <Loader2 size={36} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>{loadError || 'Form Not Found'}</h2>
        <p style={{ color: 'var(--text-muted)' }}>This form may have been removed or the link is invalid.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)', padding: '2rem', textAlign: 'center' }}>
        <div style={{ padding: '1.25rem', background: '#d1fae5', color: '#059669', borderRadius: '50%', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={48} />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.75rem' }}>{UI_STRINGS[language].success}</h2>
        <p style={{ color: 'var(--text-muted)' }}>Your valuable feedback helps us improve.</p>
      </div>
    );
  }

  const strings = UI_STRINGS[language];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>{form.title}</h1>
              {form.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{form.description}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={16} color="var(--text-muted)" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  background: 'white'
                }}
              >
                {Object.values(LANGUAGES).map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {submitError && (
            <p role="alert" style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', overflowWrap: 'anywhere' }}>
              {submitError}
            </p>
          )}
          {(form.questions || []).map((q, idx) => (
            <div key={q.id} className="card">
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                {idx + 1}. {getQuestionText(q)}
              </label>

              {q.type === 'rating' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleAnswerChange(q.id, n)}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        border: '2px solid',
                        borderColor: answers[q.id] === n ? 'var(--primary)' : 'var(--border-color)',
                        background: answers[q.id] === n ? 'var(--primary-light)' : 'white',
                        fontWeight: '700',
                        color: answers[q.id] === n ? 'var(--primary)' : 'var(--text-main)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'choice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(q.options || []).map((opt, oIdx) => (
                    <label
                      key={oIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: answers[q.id] === opt ? 'var(--primary-light)' : 'white',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === opt}
                        onChange={() => handleAnswerChange(q.id, opt)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '0.9rem' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  rows={3}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Type your answer here..."
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.925rem',
                    resize: 'vertical'
                  }}
                />
              )}

              {/* Follow-up question */}
              {followUps[q.id] && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Sparkles size={14} color="var(--primary)" />
                    <span style={{ fontSize: '0.775rem', fontWeight: '600', color: 'var(--primary)' }}>{strings.followUp}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>{followUps[q.id]}</p>
                  <textarea
                    rows={2}
                    value={followUpAnswers[q.id] || ''}
                    onChange={(e) => setFollowUpAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Optional: provide more details..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.875rem',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Voice Feedback Section */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Mic size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>{strings.addVoice}</h3>
            </div>

            {!audioBlob ? (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isRecording ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, var(--primary), var(--accent-purple))',
                  color: 'white',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Mic size={18} />
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <audio controls src={URL.createObjectURL(audioBlob)} style={{ width: '100%' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={transcribeAudio} disabled={transcribing} className="btn-secondary" style={{ flex: 1 }}>
                    {transcribing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {transcribing ? 'Transcribing...' : 'Transcribe & Analyze'}
                  </button>
                  <button type="button" onClick={() => { setAudioBlob(null); setVoiceTranscript(''); }} className="btn-secondary">
                    Re-record
                  </button>
                </div>
                {voiceTranscript && (
                  <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Transcript:</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>{voiceTranscript}</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${voiceSentiment === 'Positive' ? 'badge-green' : voiceSentiment === 'Friction' ? 'badge-red' : 'badge-amber'}`}>
                        Sentiment: {voiceSentiment}
                      </span>
                    </div>
                    {voiceSuggestions.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>AI Suggestions:</p>
                        <ul style={{ fontSize: '0.825rem', color: 'var(--text-main)', paddingLeft: '1.25rem' }}>
                          {voiceSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{strings.loading}</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>{strings.submit}</span>
              </>
            )}
          </button>
        </form>

        {/* QR Code Display */}
        {qrCodeUrl && (
          <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <QrCode size={18} color="var(--primary)" />
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Share this form</span>
            </div>
            <img src={qrCodeUrl} alt="Form QR Code" style={{ width: '160px', height: '160px', margin: '0 auto' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', wordBreak: 'break-all' }}>
              {window.location.origin}/form/{formId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
