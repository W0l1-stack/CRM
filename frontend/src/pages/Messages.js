import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

function Messages() {
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [content, setContent] = useState('');

  const userId = JSON.parse(localStorage.getItem('user')).id;
  const api = useMemo(() => axios.create({
    baseURL: process.env.REACT_APP_API_GO || 'http://localhost:3001',
    headers: { 'X-User-ID': userId }
  }), [userId]);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await api.get('/api/contacts');
      const contactList = response.data || [];
      setContacts(contactList);
      if (contactList.length > 0) {
        setSelectedContactId(contactList[0].id);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await api.get(`/api/messages/contact/${selectedContactId}`);
      setMessages(response.data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [api, selectedContactId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (selectedContactId) {
      fetchMessages();
    }
  }, [fetchMessages, selectedContactId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!content || !selectedContactId) return;

    try {
      await api.post('/api/messages', {
        contact_id: selectedContactId,
        type: 'email',
        content
      });
      setContent('');
      fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Conversations</p>
          <h1>Messages</h1>
        </div>
      </div>

      <div className="inbox-layout">
        <aside className="conversation-list">
          {loading && <p className="muted">Loading...</p>}
          {!loading && contacts.length === 0 && <p className="muted">Create a contact to start a conversation.</p>}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              className={`conversation-item ${selectedContactId === contact.id ? 'active' : ''}`}
              onClick={() => setSelectedContactId(contact.id)}
            >
              <span className="avatar">{contact.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>{contact.email || contact.phone || 'No channel yet'}</small>
              </span>
            </button>
          ))}
        </aside>

        <section className="conversation-panel">
          {selectedContactId ? (
            <>
              <div className="message-thread">
                {messages.length === 0 ? (
                  <p className="muted">No messages yet</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="message-bubble">
                      <span>{msg.type}</span>
                      <p>{msg.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form className="composer" onSubmit={handleSendMessage}>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your message..."
                  rows="3"
                />
                <button type="submit">Send Message</button>
              </form>
            </>
          ) : (
            <p className="muted">Select a contact to view messages.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default Messages;
