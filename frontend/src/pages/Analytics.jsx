import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Smile, 
  Meh, 
  Frown, 
  Sparkles, 
  RefreshCw, 
  MessageSquare, 
  Loader2, 
  AlertCircle,
  Star,
  Lightbulb,
  CheckCircle2,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../supabaseClient';

const BACKEND_URL = "http://localhost:8000";

export default function Analytics() {
  const [responses, setResponses] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Before/After comparison states
  const [beforeStart, setBeforeStart] = useState('');
  const [beforeEnd, setBeforeEnd] = useState('');
  const [afterStart, setAfterStart] = useState('');
  const [afterEnd, setAfterEnd] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  const fetchFeedbackData = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Fetch all forms
      const { data: formsData, error: formsError } = await supabase
        .from('feedback_forms')
        .select('id, title');

      if (formsError) throw formsError;
      setForms(formsData || []);

      const formIds = (formsData || []).map(f => f.id);

      if (formIds.length === 0) {
        setResponses([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('feedback_responses')
        .select('*')
        .in('form_id', formIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setResponses(data || []);

      if (data && data.length > 0) {
        analyzeResponsesWithAI(data);
      } else {
        setAiAnalysis(null);
      }
    } catch (err) {
      console.error("Error fetching feedback responses from Supabase:", err);
      setErrorMsg("Failed to load feedback responses from database.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeResponsesWithAI = async (responsesData) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/analyze-responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: responsesData })
      });

      const data = await res.json();
      if (data.status === 'success' || data.status === 'partial') {
        setAiAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("Error connecting to AI analysis endpoint:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchFeedbackData();

    const subscription = supabase
      .channel('public:feedback_responses_analytics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feedback_responses' },
        () => { fetchFeedbackData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // Compute stats from real responses
  const totalCount = responses.length;

  const validRatings = responses.filter(r => r.rating != null);
  const avgRating = validRatings.length > 0 
    ? (validRatings.reduce((sum, r) => sum + Number(r.rating), 0) / validRatings.length).toFixed(1)
    : "N/A";

  const positiveCount = responses.filter(r => (r.rating >= 4 || r.sentiment === 'Positive')).length;
  const neutralCount = responses.filter(r => (r.rating === 3 || r.sentiment === 'Neutral')).length;
  const negativeCount = responses.filter(r => ((r.rating && r.rating <= 2) || r.sentiment === 'Negative' || r.sentiment === 'Friction')).length;

  const positivePct = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;
  const neutralPct = totalCount > 0 ? Math.round((neutralCount / totalCount) * 100) : 0;
  const negativePct = totalCount > 0 ? Math.round((negativeCount / totalCount) * 100) : 0;

  const sentimentData = [
    { name: 'Positive', value: positiveCount, color: '#10b981' },
    { name: 'Neutral', value: neutralCount, color: '#f59e0b' },
    { name: 'Negative', value: negativeCount, color: '#ef4444' },
  ];

  // Before/After comparison helper
  const filterByDateRange = (start, end) => {
    if (!start || !end) return [];
    const startDate = new Date(start);
    const endDate = new Date(end + 'T23:59:59');
    return responses.filter(r => {
      const d = new Date(r.created_at);
      return d >= startDate && d <= endDate;
    });
  };

  const computeStats = (data) => {
    const count = data.length;
    const ratings = data.filter(r => r.rating != null).map(r => Number(r.rating));
    const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";
    const pos = data.filter(r => r.rating >= 4 || r.sentiment === 'Positive').length;
    const neg = data.filter(r => r.rating <= 2 || r.sentiment === 'Negative' || r.sentiment === 'Friction').length;
    return { count, avg, pos, neg, posPct: count > 0 ? Math.round((pos / count) * 100) : 0 };
  };

  const beforeData = filterByDateRange(beforeStart, beforeEnd);
  const afterData = filterByDateRange(afterStart, afterEnd);
  const beforeStats = computeStats(beforeData);
  const afterStats = computeStats(afterData);

  const getTrendIcon = (before, after) => {
    if (before === after) return <Minus size={16} color="#64748b" />;
    if (after > before) return <TrendingUp size={16} color="#10b981" />;
    return <TrendingDown size={16} color="#ef4444" />;
  };

  // Export functions
  const exportCSV = () => {
    if (responses.length === 0) return;
    const headers = ['Date', 'Form ID', 'Rating', 'Sentiment', 'Language', 'Answers', 'Follow-up Answers'];
    const rows = responses.map(r => [
      new Date(r.created_at).toLocaleString(),
      r.form_id,
      r.rating || '',
      r.sentiment || '',
      r.respondent_language || 'en',
      JSON.stringify(r.answers || {}).replace(/"/g, '""'),
      JSON.stringify(r.follow_up_answers || {}).replace(/"/g, '""')
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => { csv += row.map(c => `"${c}"`).join(',') + '\n'; });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (responses.length === 0) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('FormGenius AI - Feedback Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Responses: ${totalCount}`, 14, 34);
    doc.text(`Average Rating: ${avgRating} / 5.0`, 14, 40);
    doc.text(`Positive: ${positivePct}% | Neutral: ${neutralPct}% | Negative: ${negativePct}%`, 14, 46);

    let yPos = 56;

    if (aiAnalysis?.summary) {
      doc.setFontSize(12);
      doc.text('Executive Summary', 14, yPos);
      yPos += 6;
      doc.setFontSize(10);
      const summaryLines = doc.splitTextToSize(aiAnalysis.summary, 180);
      doc.text(summaryLines, 14, yPos);
      yPos += summaryLines.length * 5 + 6;
    }

    if (aiAnalysis?.suggestions && aiAnalysis.suggestions.length > 0) {
      doc.setFontSize(12);
      doc.text('Prioritized Suggestions', 14, yPos);
      yPos += 6;
      const sugRows = aiAnalysis.suggestions.map(s => [
        s.priority || 'N/A',
        s.suggestion || '',
        s.mentions != null ? String(s.mentions) : 'N/A',
        s.reason || ''
      ]);
      autoTable(doc, {
        head: [['Priority', 'Suggestion', 'Mentions', 'Reason']],
        body: sugRows,
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [99, 102, 241] }
      });
      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Responses table
    doc.setFontSize(12);
    doc.text('Feedback Responses', 14, yPos);
    yPos += 4;
    const respRows = responses.slice(0, 50).map(r => [
      new Date(r.created_at).toLocaleDateString(),
      r.rating || '',
      r.sentiment || '',
      JSON.stringify(r.answers || {}).slice(0, 80)
    ]);
    autoTable(doc, {
      head: [['Date', 'Rating', 'Sentiment', 'Answers (preview)']],
      body: respRows,
      startY: yPos,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`feedback-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Feedback Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Live AI sentiment synthesis & topic aggregation powered by Supabase.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={fetchFeedbackData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {totalCount > 0 && (
            <>
              <button className="btn-secondary" onClick={exportCSV}>
                <FileSpreadsheet size={16} />
                Export CSV
              </button>
              <button className="btn-secondary" onClick={exportPDF}>
                <FileText size={16} />
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Loading responses from Supabase...</h3>
        </div>
      )}

      {/* No Responses Empty State */}
      {!loading && totalCount === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '1.25rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%' }}>
            <MessageSquare size={44} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
            No feedback received yet
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', fontSize: '0.95rem' }}>
            Share your feedback forms with users to start collecting live responses in your Supabase database.
          </p>
        </div>
      )}

      {/* Active Responses & Analytics View */}
      {!loading && totalCount > 0 && (
        <>
          {/* Sentiment Overview Cards */}
          <div className="grid-3">
            
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ padding: '0.85rem', background: '#d1fae5', color: '#059669', borderRadius: 'var(--radius-lg)' }}>
                <Smile size={32} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Positive Sentiment</span>
                <h3 style={{ fontSize: '1.65rem', fontWeight: '800' }}>
                  {positivePct}% <span style={{ fontSize: '0.85rem', color: 'var(--accent-green)' }}>({positiveCount} / {totalCount})</span>
                </h3>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ padding: '0.85rem', background: '#fef3c7', color: '#d97706', borderRadius: 'var(--radius-lg)' }}>
                <Meh size={32} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Neutral / Average</span>
                <h3 style={{ fontSize: '1.65rem', fontWeight: '800' }}>
                  {neutralPct}% <span style={{ fontSize: '0.85rem', color: 'var(--accent-amber)' }}>({neutralCount} / {totalCount})</span>
                </h3>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ padding: '0.85rem', background: '#fee2e2', color: '#dc2626', borderRadius: 'var(--radius-lg)' }}>
                <Frown size={32} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Friction / Negative</span>
                <h3 style={{ fontSize: '1.65rem', fontWeight: '800' }}>
                  {negativePct}% <span style={{ fontSize: '0.85rem', color: 'var(--accent-red)' }}>({negativeCount} / {totalCount})</span>
                </h3>
              </div>
            </div>

          </div>

          {/* Charts & Summary Row */}
          <div className="grid-2">
            
            {/* Sentiment Donut Chart */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Live Sentiment Share</h3>
                <span className="badge badge-purple">Real Supabase Data</span>
              </div>

              <div style={{ width: '100%', height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Executive Summary Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles color="#8b5cf6" size={22} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Gemma AI Executive Summary</h3>
                </div>
                {analyzing && <Loader2 size={16} className="animate-spin" color="var(--primary)" />}
              </div>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flex: 1 }}>
                <p style={{ fontSize: '0.925rem', color: 'var(--text-main)', lineHeight: '1.6', fontWeight: '500' }}>
                  {aiAnalysis?.summary || "AI is synthesizing feedback sentiment..."}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
                <span>Calculated CSAT Rating: <strong>{avgRating} / 5.0</strong></span>
              </div>
            </div>

          </div>

          {/* Before & After Comparison */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', cursor: 'pointer' }} onClick={() => setShowComparison(!showComparison)}>
              <BarChart3 size={22} color="var(--primary)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Before & After Comparison</h3>
            </div>

            {showComparison && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="grid-2">
                  <div>
                    <h4 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Before Period</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input type="date" value={beforeStart} onChange={(e) => setBeforeStart(e.target.value)} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} />
                      <input type="date" value={beforeEnd} onChange={(e) => setBeforeEnd(e.target.value)} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>After Period</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input type="date" value={afterStart} onChange={(e) => setAfterStart(e.target.value)} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} />
                      <input type="date" value={afterEnd} onChange={(e) => setAfterEnd(e.target.value)} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                </div>

                {beforeData.length > 0 && afterData.length > 0 && (
                  <div className="grid-4">
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Response Count</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {getTrendIcon(beforeStats.count, afterStats.count)}
                        <span style={{ fontSize: '1.4rem', fontWeight: '800' }}>{afterStats.count}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>was {beforeStats.count}</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Avg Rating</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {getTrendIcon(Number(beforeStats.avg) || 0, Number(afterStats.avg) || 0)}
                        <span style={{ fontSize: '1.4rem', fontWeight: '800' }}>{afterStats.avg}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>was {beforeStats.avg}</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Positive %</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {getTrendIcon(beforeStats.posPct, afterStats.posPct)}
                        <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>{afterStats.posPct}%</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>was {beforeStats.posPct}%</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Negative Count</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {getTrendIcon(beforeStats.neg, afterStats.neg)}
                        <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ef4444' }}>{afterStats.neg}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>was {beforeStats.neg}</p>
                    </div>
                  </div>
                )}

                {(beforeData.length === 0 || afterData.length === 0) && (beforeStart && beforeEnd && afterStart && afterEnd) && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Select both date ranges with responses to see comparison.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI Synthesized Feedback Themes */}
          {aiAnalysis?.themes && aiAnalysis.themes.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem' }}>
                <Sparkles color="#8b5cf6" size={24} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>AI Synthesized Themes & Feedback Topics</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clustered automatically from your Supabase responses</p>
                </div>
              </div>

              <div className="grid-2">
                {aiAnalysis.themes.map((item, idx) => (
                  <div 
                    key={idx} 
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{item.theme}</h4>
                      <span className={`badge ${
                        item.sentiment === 'Positive' ? 'badge-green' : item.sentiment === 'Neutral' ? 'badge-amber' : 'badge-red'
                      }`}>
                        {item.sentiment}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                      {item.summary}
                    </p>

                    {item.sample && (
                      <div style={{ 
                        background: '#ffffff', 
                        padding: '0.75rem', 
                        borderRadius: 'var(--radius-sm)', 
                        borderLeft: '3px solid var(--primary)',
                        fontSize: '0.825rem',
                        fontStyle: 'italic',
                        color: 'var(--text-muted)'
                      }}>
                        "{item.sample}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Suggestions & Product Improvements with Priority */}
          {aiAnalysis?.suggestions && aiAnalysis.suggestions.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <Lightbulb color="#f59e0b" size={24} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>AI Prioritized Improvement Suggestions</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ranked by frequency, severity, and user impact</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {aiAnalysis.suggestions.map((sug, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    background: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${
                        sug.priority === 'High' ? 'badge-red' : sug.priority === 'Medium' ? 'badge-amber' : 'badge-blue'
                      }`}>
                        {sug.priority || 'Medium'} Priority
                      </span>
                      {sug.mentions != null && (
                        <span className="badge badge-purple">{sug.mentions} mentions</span>
                      )}
                      <span style={{ fontSize: '0.925rem', fontWeight: '600', color: 'var(--text-main)' }}>
                        {sug.suggestion}
                      </span>
                    </div>
                    {sug.reason && (
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', paddingLeft: '0.25rem' }}>
                        <strong style={{ color: 'var(--primary)' }}>Why: </strong>{sug.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
