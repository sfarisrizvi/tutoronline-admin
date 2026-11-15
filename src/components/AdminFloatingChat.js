'use client';
import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { 
  Send, 
  X, 
  Minus, 
  Maximize2, 
  ShieldCheck, 
  Loader2, 
  User, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { logAdminAction } from '../utils/logHelper';

export default function AdminFloatingChat({
  isOpen,
  onClose,
  targetUser,
  adminUser
}) {
  const [minimized, setMinimized] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const recipientName = targetUser?.name || targetUser?.full_name || 'User';
  const recipientRole = targetUser?.role || (targetUser?.hourly_rate !== undefined ? 'tutor' : 'client');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, minimized]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !minimized) {
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, minimized]);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!isOpen || !targetUser || !adminUser) return;

    let active = true;
    const supabase = createClient();

    const initConversation = async () => {
      setLoading(true);
      try {
        const adminId = adminUser.id;
        const targetId = targetUser.id;

        // 1. Check if a conversation between admin and this user already exists
        const { data: existingConvs, error: findErr } = await supabase
          .from('conversations')
          .select('*')
          .or(`and(client_id.eq.${adminId},tutor_id.eq.${targetId}),and(client_id.eq.${targetId},tutor_id.eq.${adminId})`)
          .limit(1);

        if (findErr) throw findErr;

        let conv = existingConvs && existingConvs.length > 0 ? existingConvs[0] : null;

        // 2. If no conversation exists yet, create one
        if (!conv) {
          const isTargetClient = recipientRole === 'client';
          const newConvPayload = {
            client_id: isTargetClient ? targetId : adminId,
            tutor_id: isTargetClient ? adminId : targetId,
            initiated_by: adminId,
            status: 'active',
            last_message: 'Admin initiated support chat',
            last_message_at: new Date().toISOString()
          };

          const { data: createdConv, error: createErr } = await supabase
            .from('conversations')
            .insert(newConvPayload)
            .select()
            .single();

          if (createErr) throw createErr;
          conv = createdConv;
        }

        if (!active) return;
        setConversation(conv);

        // 3. Load messages for this conversation
        const { data: msgs, error: msgErr } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        if (msgErr) throw msgErr;
        if (active) {
          setMessages(msgs || []);
        }
      } catch (err) {
        console.error('Error initializing admin floating chat:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    initConversation();

    return () => {
      active = false;
    };
  }, [isOpen, targetUser, adminUser]);

  // Real-time listener & polling fallback for new messages
  useEffect(() => {
    if (!conversation?.id) return;
    const supabase = createClient();

    // Realtime channel
    const channel = supabase
      .channel(`admin-floating-chat-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    // 4-second Polling fallback
    const interval = setInterval(async () => {
      const { data: latestMsgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (latestMsgs) {
        setMessages(latestMsgs);
      }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [conversation?.id]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !conversation?.id || !adminUser || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const supabase = createClient();
    try {
      const { data: sentMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: adminUser.id,
          receiver_id: targetUser.id,
          content: messageContent,
          message_type: 'text',
          read: false,
          read_status: false,
          delivered_status: false
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistically append message
      setMessages(prev => [...prev, sentMsg]);

      // Update conversation last_message preview
      await supabase
        .from('conversations')
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      // Dispatch real-time user notification
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: targetUser.id,
            title: 'Official Message from TutorOnline Support',
            message: messageContent.substring(0, 120),
            type: 'message',
            priority: 'HIGH',
            action_url: recipientRole === 'tutor' ? '/tutor/messages' : '/client/messages',
            read: false
          });
      } catch (nErr) {
        console.warn('Non-fatal: Failed to insert user notification:', nErr);
      }

      // Log admin audit action
      logAdminAction({
        adminUser,
        actionType: 'sent_direct_message',
        actionLabel: 'sent direct message',
        statusColor: 'green',
        targetUserName: recipientName,
        targetUserEmail: targetUser?.email || '',
        details: `Sent message: "${messageContent.substring(0, 80)}${messageContent.length > 80 ? '...' : ''}"`
      });
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message: ' + (err.message || 'Unknown error'));
      setNewMessage(messageContent); // restore message on failure
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !targetUser) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: '24px',
        width: minimized ? '280px' : '350px',
        height: minimized ? '44px' : '470px',
        backgroundColor: 'var(--canvas, #0A1929)',
        border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.15))',
        borderBottom: 'none',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        boxShadow: '0 -4px 25px rgba(0, 0, 0, 0.45)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Facebook-style Header Bar */}
      <div
        onClick={() => setMinimized(prev => !prev)}
        style={{
          height: '44px',
          padding: '0 12px',
          backgroundColor: '#0F2538',
          borderBottom: minimized ? 'none' : '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface-soft, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '11px',
              color: '#fff',
              overflow: 'hidden'
            }}>
              {targetUser.avatar_url ? (
                <img src={targetUser.avatar_url.startsWith('http') ? targetUser.avatar_url : `https://qlhcavfyllfcwifxbtbu.supabase.co/storage/v1/object/public/teacher-media/${targetUser.avatar_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                recipientName.substring(0, 2).toUpperCase()
              )}
            </div>
            {/* Online Green Indicator Dot */}
            <span style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '8px',
              height: '8px',
              backgroundColor: '#10B981',
              borderRadius: '50%',
              border: '2px solid #0F2538'
            }} />
          </div>

          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {recipientName}
              </span>
              <ShieldCheck size={13} color="#10B981" />
            </div>
            {!minimized && (
              <span style={{ fontSize: '10px', color: 'var(--steel, #94A3B8)', textTransform: 'capitalize' }}>
                {recipientRole} • Direct Support
              </span>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMinimized(prev => !prev)}
            title={minimized ? "Expand" : "Minimize"}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--steel, #94A3B8)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex'
            }}
          >
            {minimized ? <Maximize2 size={13} /> : <Minus size={14} />}
          </button>
          <button
            onClick={onClose}
            title="Close Chat"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--steel, #94A3B8)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Chat Body */}
      {!minimized && (
        <>
          {/* Intro notice banner */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
            fontSize: '11px',
            color: '#A7F3D0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <ShieldCheck size={14} color="#10B981" flexShrink={0} />
            <span>Messages appear live in {recipientName}&apos;s TutorOnline chatbox.</span>
          </div>

          {/* Messages Stream */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: 'var(--surface, #0A1929)'
          }}>
            {loading ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--steel, #94A3B8)', fontSize: '12px' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '6px' }} />
                <p style={{ margin: 0 }}>Connecting live thread...</p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--steel, #94A3B8)', fontSize: '12px', padding: '16px' }}>
                <MessageSquare size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: '#E2E8F0' }}>No messages yet</p>
                <p style={{ margin: 0, fontSize: '11px' }}>Send a message to start direct communication with {recipientName}.</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isAdmin = m.sender_id === adminUser.id;
                const timeString = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <div
                    key={m.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isAdmin ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      alignSelf: isAdmin ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: isAdmin ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      backgroundColor: isAdmin ? 'var(--brand-green, #10B981)' : '#1E293B',
                      color: '#fff',
                      fontSize: '12.5px',
                      lineHeight: '1.45',
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                    }}>
                      {m.content}
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--steel, #94A3B8)', marginTop: '2px', padding: '0 2px' }}>
                      {isAdmin ? 'You (Admin) • ' : `${recipientName} • `}{timeString}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
              backgroundColor: '#0F2538',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <input
              ref={chatInputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${recipientName}...`}
              disabled={sending || loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--hairline-strong, rgba(255, 255, 255, 0.12))',
                color: '#fff',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim() || loading}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: newMessage.trim() ? 'var(--brand-green, #10B981)' : 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: 'none',
                cursor: newMessage.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease'
              }}
            >
              {sending ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send size={13} style={{ marginLeft: '1px' }} />
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
