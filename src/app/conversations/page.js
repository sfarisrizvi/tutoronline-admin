'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { 
  Search, 
  User, 
  MessageSquare, 
  Send, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldAlert,
  RefreshCw
} from 'lucide-react';

export default function AdminConversations() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Search autocomplete states
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]); // List of { id, name, email, phone, role, avatar_url, city }
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Selected User chats states
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Names dictionary for rendering participant labels in threads
  const [usersLookup, setUsersLookup] = useState({});

  const fetchUsersAndBuildLookup = async () => {
    const supabase = createClient();
    try {
      const [
        { data: tutors },
        { data: clients }
      ] = await Promise.all([
        supabase.from('tutor_profiles').select('id, full_name, email, phone, avatar_url, city, kyc_status'),
        supabase.from('client_profiles').select('id, full_name, email, phone, avatar_url, city, client_type')
      ]);

      const unified = [];
      const lookup = {};

      if (adminUser) {
        lookup[adminUser.id] = { name: 'Support Admin (You)', email: adminUser.email, role: 'admin' };
      }

      tutors?.forEach(t => {
        const item = {
          id: t.id,
          name: t.full_name || 'Unnamed Tutor',
          email: t.email,
          phone: t.phone || '',
          role: 'tutor',
          avatar_url: t.avatar_url,
          city: t.city
        };
        unified.push(item);
        lookup[t.id] = { name: item.name, email: item.email, role: 'tutor', avatar_url: t.avatar_url };
      });

      clients?.forEach(c => {
        const item = {
          id: c.id,
          name: c.full_name || 'Unnamed Client',
          email: c.email,
          phone: c.phone || '',
          role: 'client',
          avatar_url: c.avatar_url,
          city: c.city
        };
        unified.push(item);
        lookup[c.id] = { name: item.name, email: item.email, role: 'client', avatar_url: c.avatar_url };
      });

      setAllUsers(unified);
      setUsersLookup(lookup);
    } catch (err) {
      console.error('Error fetching users lookup list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Derive autocomplete suggestions on the fly during render to prevent state warning traps
  const suggestions = searchQuery.trim() === '' ? [] : allUsers.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.phone && u.phone.includes(searchQuery))
  ).slice(0, 5);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.user_metadata?.role !== 'admin') {
        router.push('/login');
        return;
      }
      setAdminUser(user);
      setAdminRole(user.user_metadata?.admin_role || 'super_admin');

      // Unified initialization fetch
      try {
        const [
          { data: tutors },
          { data: clients }
        ] = await Promise.all([
          supabase.from('tutor_profiles').select('id, full_name, email, phone, avatar_url, city, kyc_status'),
          supabase.from('client_profiles').select('id, full_name, email, phone, avatar_url, city, client_type')
        ]);

        const unified = [];
        const lookup = {};

        lookup[user.id] = { name: 'Support Admin (You)', email: user.email, role: 'admin' };

        tutors?.forEach(t => {
          const item = {
            id: t.id,
            name: t.full_name || 'Unnamed Tutor',
            email: t.email,
            phone: t.phone || '',
            role: 'tutor',
            avatar_url: t.avatar_url,
            city: t.city
          };
          unified.push(item);
          lookup[t.id] = { name: item.name, email: item.email, role: 'tutor', avatar_url: t.avatar_url };
        });

        clients?.forEach(c => {
          const item = {
            id: c.id,
            name: c.full_name || 'Unnamed Client',
            email: c.email,
            phone: c.phone || '',
            role: 'client',
            avatar_url: c.avatar_url,
            city: c.city
          };
          unified.push(item);
          lookup[c.id] = { name: item.name, email: item.email, role: 'client', avatar_url: c.avatar_url };
        });

        setAllUsers(unified);
        setUsersLookup(lookup);
      } catch (err) {
        console.error('Error fetching users lookup list:', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Load conversations for the selected user
  const handleSelectUser = async (userItem) => {
    setSelectedUser(userItem);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedConv(null);
    setMessages([]);

    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`client_id.eq.${userItem.id},tutor_id.eq.${userItem.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch messages inside a thread
  useEffect(() => {
    if (!selectedConv) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, sender_id, content, created_at')
          .eq('conversation_id', selectedConv.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [selectedConv]);

  // Send message as Admin support chat
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || !adminUser || adminRole === 'monitor') return;

    setSendingMsg(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConv.id,
          sender_id: adminUser.id,
          content: newMessage
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setNewMessage('');
    } catch (err) {
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
          <div>
            <h1>Chat Monitor</h1>
            <p>Audit user threads or reply to ongoing client-tutor chats.</p>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={fetchUsersAndBuildLookup}>
            <RefreshCw size={14} /> Refresh Directory
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%' }}>
        
        {!selectedUser ? (
          /* Search landing panel initially when selectedUser is null */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', minHeight: '400px' }}>
            <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center', position: 'relative' }}>
              <MessageSquare size={48} style={{ color: 'var(--brand-green)', marginBottom: '16px' }} />
              <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Auditing Chat Logs</h2>
              <p style={{ color: 'var(--steel)', fontSize: '14px', marginBottom: '24px' }}>
                Locate a Client or Tutor by name, email address, or phone number to load and review their messaging channels.
              </p>

              <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', position: 'relative' }}>
                <Search size={18} style={{ color: 'var(--steel)' }} />
                <input
                  type="text"
                  className="admin-input"
                  style={{ border: 'none', background: 'transparent', color: 'var(--ink)', width: '100%', height: 'auto', padding: 0 }}
                  placeholder="Search user by Name, Email, or Phone number to audit..."
                  value={searchQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                />
              </div>

              {/* Autocomplete suggestion drop down list */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--canvas)',
                  border: '1px solid var(--hairline-strong)',
                  borderRadius: 'var(--rounded-md)',
                  boxShadow: 'var(--shadow-modal)',
                  zIndex: 990,
                  overflow: 'hidden',
                  marginTop: '4px',
                  textAlign: 'left'
                }}>
                  {suggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectUser(item)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--hairline-soft)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={16} style={{ color: 'var(--steel)' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--steel)' }}>{item.email} • {item.phone || 'No phone'}</div>
                        </div>
                      </div>
                      <span className={`admin-badge ${item.role === 'tutor' ? 'admin-badge-green' : 'admin-badge-purple'}`}>
                        {item.role === 'tutor' ? 'Tutor' : 'Client'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Workspace showing chats after a user is selected */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', flex: 1 }}>
            
            {/* Search Bar at the top of workspace */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
              <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                <Search size={18} style={{ color: 'var(--steel)' }} />
                <input
                  type="text"
                  className="admin-input"
                  style={{ border: 'none', background: 'transparent', color: 'var(--ink)', width: '100%', height: 'auto', padding: 0 }}
                  placeholder="Switch user audit: Search Name, Email, or Phone..."
                  value={searchQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                />
              </div>

              {/* Autocomplete suggestion dropdown inside workspace */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--canvas)',
                  border: '1px solid var(--hairline-strong)',
                  borderRadius: 'var(--rounded-md)',
                  boxShadow: 'var(--shadow-modal)',
                  zIndex: 990,
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  {suggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectUser(item)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--hairline-soft)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={16} style={{ color: 'var(--steel)' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--steel)' }}>{item.email} • {item.phone || 'No phone'}</div>
                        </div>
                      </div>
                      <span className={`admin-badge ${item.role === 'tutor' ? 'admin-badge-green' : 'admin-badge-purple'}`}>
                        {item.role === 'tutor' ? 'Tutor' : 'Client'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected User Header Card */}
            <div className="admin-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', padding: '20px' }}>
              {selectedUser.avatar_url ? (
                <img 
                  src={selectedUser.avatar_url.startsWith('http') ? selectedUser.avatar_url : `https://qlhcavfyllfcwifxbtbu.supabase.co/storage/v1/object/public/${selectedUser.role === 'tutor' ? 'teacher-media' : 'client-files'}/${selectedUser.avatar_url}`}
                  alt="" 
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} style={{ color: 'var(--steel)' }} />
                </div>
              )}
              
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedUser.name}
                  <span className={`admin-badge ${selectedUser.role === 'tutor' ? 'admin-badge-green' : 'admin-badge-purple'}`}>
                    {selectedUser.role === 'tutor' ? 'Tutor' : 'Client'}
                  </span>
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--steel)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {selectedUser.email}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {selectedUser.phone || 'No phone'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {selectedUser.city || 'No City'}</span>
                </div>
              </div>
            </div>

            {/* Split view: conversations sidebar / messages display */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--spacing-md)', minHeight: '450px', flex: 1 }}>
              
              {/* Sidebar: User conversations threads */}
              <div className="admin-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--hairline)', fontWeight: 600, fontSize: '14px' }}>
                  Active Chats ({conversations.length})
                </div>

                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {conversations.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '24px', color: 'var(--steel)', fontSize: '12px' }}>No conversation threads found.</p>
                  ) : (
                    conversations.map(conv => {
                      const otherId = conv.client_id === selectedUser.id ? conv.tutor_id : conv.client_id;
                      const partner = usersLookup[otherId] || { name: 'Support Admin / Support', role: 'admin' };
                      const isSelected = selectedConv?.id === conv.id;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => setSelectedConv(conv)}
                          style={{
                            padding: '16px',
                            borderBottom: '1px solid var(--hairline-soft)',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--brand-green-soft)' : 'transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{partner.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--steel)', textTransform: 'capitalize', marginTop: '2px' }}>
                            Role: {partner.role}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chat pane */}
              <div className="admin-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedConv ? (
                  <>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline)', backgroundColor: 'var(--canvas-dark)', fontSize: '13px', fontWeight: 600 }}>
                      Thread ID: {selectedConv.id}
                    </div>

                    {/* Messages Body */}
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--surface-soft)' }}>
                      {loadingMessages ? (
                        <p style={{ textAlign: 'center', color: 'var(--steel)', fontSize: '12px' }}>Loading chat logs...</p>
                      ) : messages.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--steel)', fontSize: '12px' }}>No messages exchanged.</p>
                      ) : (
                        messages.map(msg => {
                          const isSelfAdmin = msg.sender_id === adminUser?.id;
                          const sender = usersLookup[msg.sender_id] || { name: 'Support Admin', role: 'admin' };

                          return (
                            <div
                              key={msg.id}
                              style={{
                                alignSelf: isSelfAdmin ? 'center' : (sender.role === 'client' ? 'flex-start' : 'flex-end'),
                                maxWidth: '70%',
                                backgroundColor: isSelfAdmin ? 'var(--brand-teal-deep)' : 'var(--canvas)',
                                border: isSelfAdmin ? '1px solid var(--brand-green)' : '1px solid var(--hairline)',
                                padding: '10px 14px',
                                borderRadius: 'var(--rounded-md)',
                                color: 'var(--charcoal)'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '10px', color: 'var(--steel)', marginBottom: '2px', fontWeight: 600 }}>
                                <span>{sender.name} ({sender.role})</span>
                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div style={{ fontSize: '13px', wordBreak: 'break-all' }}>{msg.content}</div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Reply Form */}
                    {adminRole === 'monitor' ? (
                      <div style={{ padding: '12px', borderTop: '1px solid var(--hairline)', textAlign: 'center', fontSize: '12px', color: 'var(--steel)', backgroundColor: 'var(--canvas-dark)' }}>
                        <ShieldAlert size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        Monitor Mode: Chat input disabled
                      </div>
                    ) : (
                      <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', padding: '16px', borderTop: '1px solid var(--hairline)' }}>
                        <input
                          type="text"
                          required
                          className="admin-input"
                          placeholder="Type support reply message..."
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                        />
                        <button type="submit" className="admin-btn admin-btn-primary" disabled={sendingMsg || !newMessage.trim()}>
                          <Send size={14} />
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--steel)' }}>
                    <MessageSquare size={36} style={{ color: 'var(--muted)', marginBottom: '8px' }} />
                    <p style={{ fontSize: '13px' }}>Select a conversation thread from the left panel to review chat history.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
