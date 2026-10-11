import React, { useState } from 'react';
import { 
  Sparkles, 
  Globe, 
  UploadCloud, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Loader2, 
  Database,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Wand2,
  QrCode,
  Download,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';

const defaultQuestions = [
  {
    id: 1,
    type: 'rating',
    question: 'How satisfied are you with the overall user experience and speed of our website?',
    options: ['1 - Poor', '2 - Fair', '3 - Average', '4 - Good', '5 - Excellent']
  },
  {
    id: 2,
    type: 'choice',
    question: 'Which features do you find most valuable for your daily workflow?',
    options: ['AI Question Generation', 'Voice Feedback Collection', 'Analytics Dashboard', 'Action Items & Prioritization']
  },
  {
    id: 3,
    type: 'text',
    question: 'What is the main improvement or feature you would like to see added next?',
    options: []
  },
  {
    id: 4,
    type: 'choice',
    question: 'How easy was it to complete your purchase or setup process?',
    options: ['Extremely Easy', 'Somewhat Easy', 'Neutral', 'Difficult']
  },
  {
    id: 5,
    type: 'text',
    question: 'Any additional comments or suggestions for our design team?',
    options: []
  }
];

const BACKEND_URL = "http://localhost:8000";

export default function CreateForm() {
  const [activeTab, setActiveTab] = useState('description'); // 'description', 'url', 'screenshot'
  const [urlInput, setUrlInput] = useState('');
  const [descInput, setDescInput] = useState('A modern AI-powered feedback platform for creators and product teams.');
  
  // Screenshot states
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageFileName, setImageFileName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success' | 'error', message: string }
  
  const [questions, setQuestions] = useState(defaultQuestions);
  const [editingId, setEditingId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Smart Question Improver
  const [improvements, setImprovements] = useState([]);
  const [improving, setImproving] = useState(false);

  // Saved form & QR code
  const [savedForm, setSavedForm] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // File upload handler for screenshot tab
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setStatusMsg(null);

    let payload = { mode: activeTab };

    if (activeTab === 'description') {
      if (!descInput.trim()) {
        setStatusMsg({ type: 'error', message: 'Please enter a project description.' });
        return;
      }
      payload.description = descInput.trim();
    } else if (activeTab === 'url') {
      if (!urlInput.trim()) {
        setStatusMsg({ type: 'error', message: 'Please enter a valid website URL.' });
        return;
      }
      payload.url = urlInput.trim();
    } else if (activeTab === 'screenshot') {
      if (!imageBase64) {
        setStatusMsg({ type: 'error', message: 'Please upload a screenshot image first.' });
        return;
      }
      payload.image_base64 = imageBase64;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/generate-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate questions.');
      }

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions);
        setStatusMsg({
          type: 'success',
          message: `Generated ${data.questions.length} tailored questions based on your ${activeTab}!`
        });
      } else {
        throw new Error('No questions returned from AI backend.');
      }

    } catch (err) {
      console.error('Generation Error:', err);
      setStatusMsg({
        type: 'error',
        message: err.message || 'Error connecting to FastAPI backend (http://localhost:8000).'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: Date.now(),
      type: 'text',
      question: 'New custom feedback question...',
      options: []
    };
    setQuestions([...questions, newQ]);
  };

  const handleDeleteQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleUpdateQuestion = (id, newText) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, question: newText } : q));
  };

  const handleCopy = () => {
    if (!savedForm) return;
    const publicUrl = `${window.location.origin}/form/${savedForm.id}`;
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleImproveQuestions = async () => {
    setImproving(true);
    setImprovements([]);
    try {
      const res = await fetch(`${BACKEND_URL}/improve-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions })
      });
      const data = await res.json();
      if (data.improvements && data.improvements.length > 0) {
        setImprovements(data.improvements);
      } else {
        setStatusMsg({ type: 'success', message: 'All questions look good! No improvements needed.' });
      }
    } catch (err) {
      console.error('Question improvement error:', err);
      setStatusMsg({ type: 'error', message: 'Failed to analyze questions.' });
    } finally {
      setImproving(false);
    }
  };

  const acceptImprovement = (questionId, suggested) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, question: suggested } : q));
    setImprovements(improvements.filter(i => i.question_id !== questionId));
  };

  const rejectImprovement = (questionId) => {
    setImprovements(improvements.filter(i => i.question_id !== questionId));
  };

  const handleSaveToSupabase = async () => {
    setIsSaving(true);
    setStatusMsg(null);

    const formPayload = {
      title: activeTab === 'url' ? (urlInput || 'Website Form') : 'AI Feedback Form',
      description: descInput || urlInput || 'FormGenius AI generated form',
      questions: questions,
      status: 'Active',
      default_language: 'en'
    };

    try {
      const { data, error } = await supabase
        .from('feedback_forms')
        .insert([formPayload])
        .select()
        .single();

      if (error) {
        console.error('Supabase form save failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setStatusMsg({
          type: 'error',
          message: `Save failed${error.code ? ` (${error.code})` : ''}: ${error.message}${error.hint ? ` Hint: ${error.hint}` : ''}`
        });
      } else {
        setSavedForm(data);
        // Generate QR code for the public form URL
        const publicUrl = `${window.location.origin}/form/${data.id}`;
        QRCode.toDataURL(publicUrl, { width: 256, margin: 2 })
          .then(url => setQrCodeUrl(url))
          .catch(() => {});
        setStatusMsg({
          type: 'success',
          message: 'Form saved successfully! Share it using the QR code or link below.'
        });
      }
    } catch (err) {
      console.error('Supabase exception:', err);
      setStatusMsg({
        type: 'error',
        message: err.message || 'Unexpected error while connecting to Supabase'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>AI Form Generator</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Describe your project, enter a website URL, or upload a screenshot to generate tailored feedback questions using Gemma & Gemini AI.
        </p>
      </div>

      {/* Input Selection Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => { setActiveTab('description'); setStatusMsg(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'description' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'description' ? 'var(--primary)' : 'var(--text-muted)'
            }}
          >
            <FileText size={18} />
            Project Description
          </button>

          <button
            onClick={() => { setActiveTab('url'); setStatusMsg(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'url' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'url' ? 'var(--primary)' : 'var(--text-muted)'
            }}
          >
            <Globe size={18} />
            Website URL
          </button>

          <button
            onClick={() => { setActiveTab('screenshot'); setStatusMsg(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === 'screenshot' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'screenshot' ? 'var(--primary)' : 'var(--text-muted)'
            }}
          >
            <UploadCloud size={18} />
            Upload Screenshot
          </button>
        </div>

        {/* Tab Inputs */}
        {activeTab === 'description' && (
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Describe your project or target feature:
            </label>
            <textarea
              rows={4}
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="e.g., A food delivery application focusing on quick checkout and local organic restaurant listings..."
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.925rem',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {activeTab === 'url' && (
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Enter your live website URL:
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.925rem'
              }}
            />
          </div>
        )}

        {activeTab === 'screenshot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{
              border: '2px dashed var(--primary-light)',
              background: 'rgba(99, 102, 241, 0.02)',
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'block'
            }}>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageFileChange}
                style={{ display: 'none' }}
              />
              <UploadCloud size={40} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
              <h4 style={{ fontWeight: '700', fontSize: '1rem' }}>
                {imageFileName ? `Selected: ${imageFileName}` : 'Click to select screenshot image'}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Supports PNG, JPG, WebP up to 10MB
              </p>
            </label>

            {imagePreview && (
              <div style={{ textAlign: 'center', background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <img 
                  src={imagePreview} 
                  alt="Screenshot Preview" 
                  style={{ maxHeight: '220px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} 
                />
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <div>
          <button 
            className="btn-primary" 
            onClick={handleGenerate} 
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '0.9rem' }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Generating tailored questions with AI...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>
                  {activeTab === 'description' ? 'Generate Questions from Description' :
                   activeTab === 'url' ? 'Scrape & Generate Questions from URL' :
                   'Analyze Screenshot & Generate Questions'}
                </span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Status Toast Notification */}
      {statusMsg && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          background: statusMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: statusMsg.type === 'success' ? '#047857' : '#b91c1c',
          border: `1px solid ${statusMsg.type === 'success' ? '#a7f3d0' : '#fca5a5'}`
        }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMsg.message}</span>
        </div>
      )}

      {/* Generated Questions List Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Generated Form Questions</span>
              <span className="badge badge-purple">{questions.length} Questions</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Customize, edit or add questions before saving to Supabase</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleAddQuestion}>
              <Plus size={16} />
              Add Question
            </button>

            <button className="btn-secondary" onClick={handleImproveQuestions} disabled={improving}>
              {improving ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {improving ? 'Analyzing...' : 'Improve Questions'}
            </button>

            <button className="btn-secondary" onClick={handleCopy} disabled={!savedForm}>
              {linkCopied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
              {linkCopied ? 'Link Copied!' : 'Copy Form Link'}
            </button>

            <button 
              className="btn-primary" 
              onClick={handleSaveToSupabase} 
              disabled={isSaving}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
              <span>{isSaving ? 'Saving...' : 'Save Form to Supabase'}</span>
            </button>
          </div>
        </div>

        {/* Questions Render Loop */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.map((q, idx) => (
            <div 
              key={q.id || idx} 
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1 }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.95rem' }}>
                    Q{idx + 1}.
                  </span>
                  
                  {editingId === q.id ? (
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => handleUpdateQuestion(q.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--primary)',
                        fontSize: '0.95rem',
                        fontWeight: '600'
                      }}
                    />
                  ) : (
                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {q.question}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${
                    q.type === 'rating' ? 'badge-amber' : q.type === 'choice' ? 'badge-blue' : 'badge-purple'
                  }`}>
                    {(q.type || 'text').toUpperCase()}
                  </span>

                  <button 
                    style={{ background: 'transparent', color: 'var(--text-muted)' }} 
                    onClick={() => setEditingId(editingId === q.id ? null : q.id)}
                  >
                    <Edit3 size={16} />
                  </button>

                  <button 
                    style={{ background: 'transparent', color: 'var(--accent-red)' }} 
                    onClick={() => handleDeleteQuestion(q.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Options preview */}
              {q.options && q.options.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingLeft: '2rem' }}>
                  {q.options.map((opt, oIdx) => (
                    <span key={oIdx} style={{
                      fontSize: '0.8rem',
                      background: '#ffffff',
                      border: '1px solid var(--border-color)',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)'
                    }}>
                      {opt}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Smart Question Improvements */}
        {improvements.length > 0 && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Wand2 size={18} color="#b45309" />
              <h4 style={{ fontWeight: '700', fontSize: '0.95rem', color: '#92400e' }}>AI Suggested Improvements</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {improvements.map((imp, idx) => (
                <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <strong>Issue:</strong> {imp.issue}
                  </p>
                  <p style={{ fontSize: '0.875rem', textDecoration: 'line-through', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {imp.original}
                  </p>
                  <p style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    → {imp.suggested}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => acceptImprovement(imp.question_id, imp.suggested)}
                      style={{ padding: '0.35rem 0.85rem', background: 'var(--accent-green)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '600' }}
                    >
                      <Check size={14} style={{ display: 'inline' }} /> Accept
                    </button>
                    <button
                      onClick={() => rejectImprovement(imp.question_id)}
                      style={{ padding: '0.35rem 0.85rem', background: 'var(--border-color)', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '600' }}
                    >
                      <X size={14} style={{ display: 'inline' }} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* QR Code & Share Section */}
      {savedForm && qrCodeUrl && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <QrCode size={22} color="var(--primary)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Share Your Feedback Form</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Scan this QR code or copy the link to share your form. Anyone can submit feedback without logging in.
          </p>
          <img src={qrCodeUrl} alt="Form QR Code" style={{ width: '200px', height: '200px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem', background: 'white' }} />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={handleCopy}>
              {linkCopied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
              {linkCopied ? 'Link Copied!' : 'Copy Link'}
            </button>
            <a
              href={qrCodeUrl}
              download={`form-${savedForm.id}.png`}
              className="btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <Download size={16} />
              Download QR
            </a>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all', textAlign: 'center', maxWidth: '100%' }}>
            {window.location.origin}/form/{savedForm.id}
          </div>
        </div>
      )}

    </div>
  );
}
