import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

function Deals() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    contact_id: '',
    name: '',
    value: '',
    stage: 'prospect',
    probability: 50
  });

  const userId = JSON.parse(localStorage.getItem('user')).id;
  const api = useMemo(() => axios.create({
    baseURL: process.env.REACT_APP_API_GO || 'http://localhost:3001',
    headers: { 'X-User-ID': userId }
  }), [userId]);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await api.get('/api/contacts');
      setContacts(response.data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, [api]);

  const fetchDeals = useCallback(async () => {
    try {
      const response = await api.get('/api/deals');
      setDeals(response.data || []);
    } catch (err) {
      console.error('Error fetching deals:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchDeals();
    fetchContacts();
  }, [fetchContacts, fetchDeals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/deals', formData);
      setFormData({ contact_id: '', name: '', value: '', stage: 'prospect', probability: 50 });
      setShowForm(false);
      fetchDeals();
    } catch (err) {
      console.error('Error creating deal:', err);
    }
  };

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Opportunities</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Deal'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Deal Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Contact</label>
            <select
              required
              value={formData.contact_id}
              onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
            >
              <option value="">Choose contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Value</label>
            <input
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Stage</label>
            <select
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
            >
              <option>prospect</option>
              <option>qualified</option>
              <option>proposal</option>
              <option>negotiation</option>
              <option>closed</option>
            </select>
          </div>
          <div className="form-group">
            <label>Probability (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.probability}
              onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
            />
          </div>
          <button type="submit">Create Deal</button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Stage</th>
            <th>Value</th>
            <th>Probability</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              <td>{deal.name}</td>
              <td>{contacts.find((contact) => contact.id === deal.contact_id)?.name || deal.contact_id}</td>
              <td>{deal.stage}</td>
              <td>${deal.value}</td>
              <td>{deal.probability}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Deals;
