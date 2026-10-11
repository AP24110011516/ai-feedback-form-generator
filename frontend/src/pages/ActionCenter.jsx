import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  Loader2,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Circle,
  Inbox,
  Sparkles,
  Clock,
  TrendingUp,
  Flag,
  XCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const BACKEND_URL = "http://localhost:8000";

const PRIORITY_STYLES = {
  High: { bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', label: 'HIGH' },
  Medium: { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', label: 'MEDIUM' },
  Low: { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', label: 'LOW' }
};

const STATUS_STYLES = {
  open: { color: '#94a3b8', icon: Circle, label: 'Open' },
  in_progress: { color: '#f59e0b', icon: Clock, label: 'In Progress' },
  resolved: { color: '#10b981', icon: CheckCircle2, label: 'Resolved' }
};

export default function ActionCenter() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [summary, setSummary] = useState(null);

  const fetchActionItems = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Get all forms
      const { data: formsData, error: formsError } = await supabase
        .from('feedback_forms')
        .select('id, title');

      if (formsError) throw formsError;

      const formIds = (formsData || []).map(f => f.id);
      if (formIds.length === 0) {
        setTasks([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      // Get responses for user's forms
      const { data: responsesData, error: respError } = await supabase
        .from('feedback_responses')
        .select('*')
        .in('form_id', formIds);

      if (respError) throw respError;

      if (responsesData && responsesData.length > 0) {
        setAnalyzing(true);
        try {
          const res = await fetch(`${BACKEND_URL}/analyze-responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responses: responsesData })
          });
          const data = await res.json();

          if (data.analysis) {
            setSummary(data.analysis.summary || null);

            // Build tasks from AI suggestions with priority
            const aiTasks = (data.analysis.suggestions || []).map((sug, idx) => ({
              id: `ai-${idx}`,
              title: sug.suggestion,
              priority: sug.priority || 'Medium',
              reason: sug.reason || '',
              mentions: sug.mentions || 0,
              status: 'open',
              source: 'AI Analysis',
              type: 'suggestion'
            }));

            // Build tasks from complaints
            const complaintTasks = (data.analysis.complaints || []).map((c, idx) => ({
              id: `complaint-${idx}`,
              title: c,
              priority: 'High',
              reason: 'Direct user complaint',
              mentions: 1,
              status: 'open',
              source: 'User Complaints',
              type: 'complaint'
            }));

            // Build tasks from negative sentiment themes
            const themeTasks = (data.analysis.themes || [])
              .filter(t => t.sentiment === 'Negative' || t.sentiment === 'Friction')
              .map((t, idx) => ({
                id: `theme-${idx}`,
                title: t.theme,
                priority: 'Medium',
                reason: t.summary,
                mentions: t.mentions || 0,
                status: 'open',
                source: 'Sentiment Analysis',
                type: 'theme'
              }));

            setTasks([...aiTasks, ...complaintTasks, ...themeTasks]);
          }
        } catch (aiErr) {
          console.error('AI analysis failed:', aiErr);
          setTasks([]);
        } finally {
          setAnalyzing(false);
        }
      } else {
        setTasks([]);
        setSummary(null);
      }
    } catch (err) {
      console.error('Action center error:', err);
      setErrorMsg('Failed to load action items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActionItems();
  }, []);

  const updateTaskStatus = (taskId, newStatus) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const getPriorityStyle = (p) => PRIORITY_STYLES[p] || PRIORITY_STYLES.Medium;
  const getStatusStyle = (s) => STATUS_STYLES[s] || STATUS_STYLES.open;

  const sortedTasks = [...tasks].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });

  const openCount = tasks.filter(t => t.status === 'open').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tasks.filter(t => t.status === 'resolved').length;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Lightbulb color="#f59e0b" size={28} />
            AI Action Center
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Prioritized product improvements & feedback tasks generated from real user responses.
          </p>
        </div>

        <button className="btn-secondary" onClick={fetchActionItems} disabled={loading || analyzing}>
          {loading || analyzing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {analyzing ? 'AI Analyzing...' : 'Regenerate Insights'}
        </button>
      </div>

      {/* Loading */}
      {(loading || analyzing) && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={40} className="animate-spin" color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
            {analyzing ? 'AI is prioritizing feedback...' : 'Loading your action items...'}
          </h3>
          {analyzing && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Analyzing sentiment, frequency, and user impact from Supabase data.
            </p>
          )}
        </div>
      )}

      {/* Summary Banner */}
      {!loading && summary && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))',
          border: '1px solid var(--primary-light)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start'
        }}>
          <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '12px', flexShrink: 0 }}>
            <Sparkles size={22} color="var(--primary)" />
          </div>
          <div>
            <p style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.25rem' }}>AI Executive Insight</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.6' }}>{summary}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && tasks.length > 0 && (
        <div className="grid-4">
          <div className="card" style={{ textAlign: 'center' }}>
            <Circle size={22} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{openCount}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Open</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <Clock size={22} color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{inProgressCount}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>In Progress</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <CheckCircle2 size={22} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{resolvedCount}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Resolved</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <TrendingUp size={22} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{tasks.length}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total Items</p>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {!loading && !analyzing && tasks.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1.25rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%' }}>
            <Inbox size={44} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>No action items yet</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', fontSize: '0.95rem' }}>
            Collect some feedback responses first. The AI will automatically generate prioritized action items based on real user sentiment, complaints, and suggestions.
          </p>
        </div>
      )}

      {!loading && !analyzing && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedTasks.map((task) => {
            const pStyle = getPriorityStyle(task.priority);
            const sStyle = getStatusStyle(task.status);
            const StatusIcon = sStyle.icon;
            return (
              <div
                key={task.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderLeft: `4px solid ${pStyle.color}`,
                  opacity: task.status === 'resolved' ? 0.65 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                      <span style={{
                        background: pStyle.bg,
                        color: pStyle.color,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        letterSpacing: '0.5px'
                      }}>
                        {pStyle.label}
                      </span>
                      <span className="badge badge-blue">{task.source}</span>
                      {task.mentions > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Flag size={12} /> {task.mentions} mention{task.mentions !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: 'var(--text-main)',
                      textDecoration: task.status === 'resolved' ? 'line-through' : 'none'
                    }}>
                      {task.title}
                    </h4>
                  </div>

                  {/* Status Selector */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    {['open', 'in_progress', 'resolved'].map((status) => {
                      const st = STATUS_STYLES[status];
                      const Icon = st.icon;
                      return (
                        <button
                          key={status}
                          onClick={() => updateTaskStatus(task.id, status)}
                          style={{
                            padding: '0.4rem 0.7rem',
                            borderRadius: 'var(--radius-sm)',
                            border: task.status === status ? `2px solid ${st.color}` : '1px solid var(--border-color)',
                            background: task.status === status ? `${st.color}15` : 'transparent',
                            color: task.status === status ? st.color : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Icon size={13} />
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {task.reason && (
                  <div style={{
                    background: '#f8fafc',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5'
                  }}>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Priority Reason: </span>
                    {task.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
