import { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MdBusiness, MdCheckCircle, MdDescription, MdEmail, MdGroup, MdLocationOn, MdPerson, MdPhone, MdSend } from 'react-icons/md';

const initialForm = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  industry: '',
  address: '',
  notes: '',
  preferredDelivery: 'email'
};

export default function ClientsTab() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setClients(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading clients:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.companyName.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      setMessage('Please add company, contact name, and email before saving.');
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, 'clients'), {
        ...form,
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        phone: form.phone.trim(),
        industry: form.industry.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        status: 'active',
        createdAt: serverTimestamp()
      });
      setForm(initialForm);
      setMessage('Client saved successfully.');
    } catch (error) {
      console.error('Error saving client:', error);
      setMessage('Unable to save client right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.heroCard}>
        <div>
          <div style={styles.eyebrow}>Client management</div>
          <h2 style={styles.title}>Clients</h2>
          <p style={styles.subtitle}>Add clients here so you can reuse their details later when sending proposals.</p>
        </div>
        <div style={styles.heroStat}>
          <MdGroup size={22} />
          <span>{clients.length} saved clients</span>
        </div>
      </div>

      <div style={styles.panelGrid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <MdPerson size={20} color="#2563EB" />
              <h3 style={styles.cardTitle}>Add new client</h3>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <label style={styles.label}>Company Name</label>
              <input name="companyName" value={form.companyName} onChange={handleChange} style={styles.input} placeholder="Acme Solutions" required />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Contact Name</label>
              <input name="contactName" value={form.contactName} onChange={handleChange} style={styles.input} placeholder="Alex Morgan" required />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Email</label>
              <input name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} style={styles.input} placeholder="alex@acme.com" required />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} style={styles.input} placeholder="+1 555 0123" />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Industry</label>
              <input name="industry" value={form.industry} onChange={handleChange} style={styles.input} placeholder="Consulting" />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Address</label>
              <input name="address" value={form.address} onChange={handleChange} style={styles.input} placeholder="123 River Street" />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Preferred delivery</label>
              <select name="preferredDelivery" value={form.preferredDelivery} onChange={handleChange} style={styles.input}>
                <option value="email">Email</option>
                <option value="portal">Portal</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} placeholder="Client preferences or proposal notes" />
            </div>

            {message ? <div style={styles.message}>{message}</div> : null}

            <button type="submit" style={styles.primaryButton} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Client'}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <MdBusiness size={20} color="#0F766E" />
              <h3 style={styles.cardTitle}>Saved clients</h3>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading clients...</div>
          ) : clients.length === 0 ? (
            <div style={styles.emptyState}>No clients saved yet. Use the form to add one.</div>
          ) : (
            <div style={styles.clientList}>
              {clients.map((client) => (
                <div key={client.id} style={styles.clientItem}>
                  <div style={styles.clientHeader}>
                    <strong>{client.companyName}</strong>
                    <span style={styles.badge}>{client.status || 'active'}</span>
                  </div>
                  <div style={styles.clientDetail}><MdPerson size={16} /> {client.contactName}</div>
                  <div style={styles.clientDetail}><MdEmail size={16} /> {client.contactEmail}</div>
                  {client.phone ? <div style={styles.clientDetail}><MdPhone size={16} /> {client.phone}</div> : null}
                  {client.industry ? <div style={styles.clientDetail}><MdDescription size={16} /> {client.industry}</div> : null}
                  {client.address ? <div style={styles.clientDetail}><MdLocationOn size={16} /> {client.address}</div> : null}
                  {client.preferredDelivery ? <div style={styles.clientDetail}><MdSend size={16} /> Preferred: {client.preferredDelivery}</div> : null}
                  {client.notes ? <div style={{ ...styles.clientDetail, color: '#475569' }}>{client.notes}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  heroCard: {
    background: 'linear-gradient(135deg, #0F172A 0%, #2563EB 100%)',
    borderRadius: 18,
    padding: 20,
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap'
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    opacity: 0.8,
    marginBottom: 6
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800
  },
  subtitle: {
    margin: '6px 0 0',
    maxWidth: 620,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.9)'
  },
  heroStat: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 999,
    padding: '10px 14px',
    fontWeight: 700
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 18
  },
  card: {
    background: '#fff',
    border: '1px solid #E6EEF8',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)'
  },
  cardHeader: {
    marginBottom: 12
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    color: '#0F172A'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A'
  },
  input: {
    border: '1px solid #CBD5E1',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none'
  },
  message: {
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 10,
    background: '#EFF6FF',
    color: '#1D4ED8'
  },
  primaryButton: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    background: '#2563EB',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  clientItem: {
    border: '1px solid #E6EEF8',
    borderRadius: 12,
    padding: 12,
    background: '#F8FAFC'
  },
  clientHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  badge: {
    background: '#DCFCE7',
    color: '#166534',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'capitalize'
  },
  clientDetail: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#475569',
    marginTop: 4
  },
  emptyState: {
    padding: 18,
    borderRadius: 10,
    border: '1px dashed #CBD5E1',
    color: '#64748B',
    background: '#F8FAFC',
    textAlign: 'center'
  }
};
