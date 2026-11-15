'use client';
import React, { useState } from 'react';
import { Mail, X, Send, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { logAdminAction } from '../utils/logHelper';

const NOTICE_TEMPLATES = [
  {
    label: 'Document Resubmission',
    subject: 'Action Required: Please update your verification documents',
    message: 'We reviewed your verification documents and noticed that one or more files require clarification or resubmission. Please log in to your account, review the flagged objections, and upload clear, legible copies to proceed with your account verification.'
  },
  {
    label: 'Account Policy Reminder',
    subject: 'Important Reminder Regarding TutorOnline Terms & Conduct',
    message: 'This is a gentle reminder regarding our platform community guidelines and policy terms. Please ensure your contact details, profile information, and student interactions comply fully with our standards to maintain your verified standing.'
  },
  {
    label: 'Profile Incomplete Notice',
    subject: 'Complete your tutor profile to start receiving tuition requests',
    message: 'Your profile is currently incomplete. Completing your profile details and submitting your verification credentials will grant you verified status and make your profile visible to parents and students searching in your area.'
  },
  {
    label: 'General Support Inquiry',
    subject: 'Message from TutorOnline Administration',
    message: 'We are reaching out regarding your account. Please review this message and let us know if you need assistance or have any questions.'
  }
];

export default function AdminNoticeModal({
  isOpen,
  onClose,
  targetUser,
  adminUser,
  onSuccess
}) {
  const [subject, setSubject] = useState('Important Notice from TutorOnline Administration');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('https://tutoronline.pk/login');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !targetUser) return null;

  const recipientName = targetUser.name || targetUser.full_name || 'User';
  const recipientEmail = targetUser.email || '';
  const recipientRole = targetUser.role || (targetUser.hourly_rate !== undefined ? 'Tutor' : 'Client');

  const handleApplyTemplate = (tpl) => {
    setSubject(tpl.subject);
    setMessage(tpl.message);
    setError(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipientEmail) {
      setError('Recipient email is missing.');
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setError('Please compose a notice message with at least 5 characters.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          recipientName,
          subject: subject.trim(),
          message: message.trim(),
          actionUrl: actionUrl.trim(),
          userId: targetUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch email notice');
      }

      // Log admin audit action
      logAdminAction({
        adminUser,
        actionType: 'sent_email_notice',
        actionLabel: 'sent email notice',
        statusColor: 'green',
        targetUserName: recipientName,
        targetUserEmail: recipientEmail,
        details: `Subject: "${subject.trim()}". Notice dispatched via official email template.`
      });

      if (onSuccess) {
        onSuccess(`Official notice emailed successfully to ${recipientEmail}`);
      }
      onClose();
    } catch (err) {
      console.error('Error sending notice:', err);
      setError(err.message || 'An error occurred while dispatching the notice.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      className="admin-modal-overlay" 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div 
        className="admin-modal-box"
        style={{
          backgroundColor: 'var(--canvas, #0A1929)',
          border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
          backgroundColor: 'var(--surface-soft, rgba(255, 255, 255, 0.02))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(217, 119, 6, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B'
            }}>
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                Send Official Email Notice
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--steel, #94A3B8)' }}>
                To: <span style={{ color: '#fff', fontWeight: 500 }}>{recipientName}</span> ({recipientEmail}) • <span style={{ textTransform: 'capitalize' }}>{recipientRole}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={sending}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--steel, #94A3B8)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Quick template chips */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--steel, #94A3B8)', marginBottom: '8px' }}>
              <Sparkles size={13} color="#F59E0B" /> Quick Notice Presets:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {NOTICE_TEMPLATES.map((tpl, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => handleApplyTemplate(tpl)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
                    borderRadius: '20px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    color: '#E2E8F0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.borderColor = 'var(--brand-green, #10B981)'}
                  onMouseLeave={(e) => e.target.style.borderColor = 'var(--hairline, rgba(255, 255, 255, 0.08))'}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Field */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
              Notice Subject
            </label>
            <input 
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Important Notice Regarding Your Tutor Account"
              required
              disabled={sending}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.15))',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Message Content Field */}
          <div style={{ marginBottom: '14px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#E2E8F0' }}>
                Notice Content (Message Body)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--steel, #94A3B8)' }}>
                {message.length} characters
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Compose your instructions, account notice, or feedback to the user here. Line breaks are preserved."
              rows={6}
              required
              disabled={sending}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.15))',
                color: '#fff',
                fontSize: '13px',
                lineHeight: '1.5',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Action URL Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
              Action Button Link (URL in Email)
            </label>
            <input 
              type="text"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="e.g. https://tutoronline.pk/tutor/onboarding"
              disabled={sending}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.15))',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#F87171'
            }}>
              <AlertCircle size={16} flexShrink={0} />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.15))',
                color: '#E2E8F0',
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !recipientEmail}
              style={{
                backgroundColor: 'var(--brand-green, #10B981)',
                border: 'none',
                color: '#fff',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              {sending ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Sending Notice...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Email Notice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
