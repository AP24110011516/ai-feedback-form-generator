import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquareText, 
  Star, 
  Sparkles, 
  Mic, 
  Plus, 
  Loader2,
  RefreshCw,
  InboxIcon,
  Share2,
  Eye
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const navigate = useNavigate();

  const [forms, setForms] = useState([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [responsesByForm, setResponsesByForm] = useState({});
  const [avgRating, setAvgRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    let currentQuery = 'feedback_forms';

    try {
      const { data: formsData, error: formsError } = await supabase
        .from('feedback_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (formsError) throw formsError;

      const formIds = (formsData || []).map(f => f.id);
      let responsesData = [];
      if (formIds.length > 0) {
        currentQuery = 'feedback_responses';
        const { data: respData, error: respError } = await supabase
          .from('feedback_responses')
          .select('form_id, rating, created_at')
          .in('form_id', formIds);

        if (respError) throw respError;
        responsesData = respData || [];
      }

      setForms(formsData || []);
      setTotalResponses(responsesData.length);

      const counts = {};
      responsesData.forEach(r => {
        counts[r.form_id] = (counts[r.form_id] || 0) + 1;
      });
      setResponsesByForm(counts);

      const validRatings = responsesData.filter(r => r.rating != null);
      if (validRatings.length > 0) {
        const avg = validRatings.reduce((sum, r) => sum + Number(r.rating), 0) / validRatings.length;
        setAvgRating(avg.toFixed(1));
      } else {
        setAvgRating(null);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', {
        query: currentQuery,
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
      });
      const details = [
        err?.code && `Code: ${err.code}`,
        err?.message || String(err),
        err?.details && `Details: ${err.details}`,
        err?.hint && `Hint: ${err.hint}`,
      ].filter(Boolean).join('\n');
      setErrorMsg(`Could not load ${currentQuery}.\n${details}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const subscription = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_responses' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_forms' }, fetchDashboardData)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [fetchDashboardData]);

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const shareForm = (formId) => {
    const publicUrl = `${window.location.origin}/form/${formId}`;
    navigator.clipboard.writeText(publicUrl);
    alert(`Form link copied to clipboard!\n${publicUrl}`);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Banner / Welcome Header */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311b92 100%)',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2rem',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Sparkles size={14} color="#a855f7" />
            <span>Gemma AI Engine Active</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            Welcome to FormGenius AI 👋
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', maxWidth: '560px' }}>
            Your AI-powered feedback collection platform. Create forms, collect responses, and gain actionable insights.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => navigate('/create')}>
            <Plus size={18} />
            Create AI Form
          </button>
          <button className="btn-secondary" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => navigate('/voice')}>
            <Mic size={18} />
            Voice Feedback
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
          <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Loading your dashboard data...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && errorMsg && (
        <div role="alert" className="card" style={{ textAlign: 'left', padding: '2rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
          <p style={{ fontWeight: '600', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{errorMsg}</p>
          <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={fetchDashboardData}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {!loading && !errorMsg && (
        <div className="grid-4">
          {/* Total Responses */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total Responses</span>
                <h3 style={{ fontSize: '1.85rem', fontWeight: '800', marginTop: '0.25rem' }}>
                  {totalResponses.toLocaleString()}
                </h3>
              </div>
              <div style={{ padding: '0.65rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: 'var(--radius-md)' }}>
                <MessageSquareText size={22} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              {totalResponses === 0 ? 'No responses collected yet' : 'From your Supabase database'}
            </p>
          </div>

          {/* Avg Rating */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Avg Rating Score</span>
                <h3 style={{ fontSize: '1.85rem', fontWeight: '800', marginTop: '0.25rem' }}>
                  {avgRating ? <>{avgRating} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: '500' }}>/ 5.0</span></> : '—'}
                </h3>
              </div>
              <div style={{ padding: '0.65rem', background: '#fef3c7', color: '#d97706', borderRadius: 'var(--radius-md)' }}>
                <Star size={22} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              {avgRating ? 'Calculated from real responses' : 'No ratings collected yet'}
            </p>
          </div>

          {/* Total Forms */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Feedback Forms</span>
                <h3 style={{ fontSize: '1.85rem', fontWeight: '800', marginTop: '0.25rem' }}>
                  {forms.length}
                </h3>
              </div>
              <div style={{ padding: '0.65rem', background: '#d1fae5', color: '#059669', borderRadius: 'var(--radius-md)' }}>
                <Sparkles size={22} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              {forms.length === 0 ? 'No forms created yet' : `${forms.filter(f => f.status === 'Active').length} active`}
            </p>
          </div>

          {/* Quick Action */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Analytics</span>
                <h3 style={{ fontSize: '1.85rem', fontWeight: '800', marginTop: '0.25rem' }}>AI Insights</h3>
              </div>
              <div style={{ padding: '0.65rem', background: '#f3e8ff', color: '#7e22ce', borderRadius: 'var(--radius-md)' }}>
                <Sparkles size={22} />
              </div>
            </div>
            <button
              className="btn-secondary"
              style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
              onClick={() => navigate('/analytics')}
            >
              View Analytics
            </button>
          </div>
        </div>
      )}

      {/* Feedback Forms Table */}
      {!loading && !errorMsg && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Your Feedback Forms</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Forms saved to your Supabase database</p>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/create')}>
              <Plus size={16} />
              New Form
            </button>
          </div>

          {forms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '1.25rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%' }}>
                <InboxIcon size={40} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>No feedback forms yet</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '0.9rem' }}>
                Create your first AI-powered feedback form to start collecting responses.
              </p>
              <button className="btn-primary" onClick={() => navigate('/create')} style={{ marginTop: '0.5rem' }}>
                <Plus size={18} />
                Create Your First Form
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Form Title</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Responses</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((form) => (
                    <tr key={form.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-main)', maxWidth: '220px' }}>
                        {form.title || 'Untitled Form'}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '260px' }}>
                        {form.description ? form.description.slice(0, 80) + (form.description.length > 80 ? '…' : '') : '—'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className="badge badge-blue">{responsesByForm[form.id] || 0}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${form.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>
                          {form.status || 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {formatDate(form.created_at)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            title="View public form"
                            style={{ background: 'transparent', color: 'var(--primary)' }}
                            onClick={() => window.open(`/form/${form.id}`, '_blank')}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            title="Copy share link"
                            style={{ background: 'transparent', color: 'var(--primary)' }}
                            onClick={() => shareForm(form.id)}
                          >
                            <Share2 size={16} />
                          </button>
                          <button 
                            style={{ background: 'transparent', color: 'var(--primary)', fontWeight: '600', fontSize: '0.85rem' }}
                            onClick={() => navigate('/analytics')}
                          >
                            Analytics
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
