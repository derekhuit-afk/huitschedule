'use client';
import { useState, useEffect } from 'react';

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function BookingPage() {
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  // Load event types
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat) setCategory(cat);

    const url = cat ? `/api/event-types?category=${cat}` : '/api/event-types';
    fetch(url)
      .then(r => r.json())
      .then(d => { setEventTypes(d.event_types || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Load slots when date changes
  useEffect(() => {
    if (!selected || !selectedDate) return;
    setSlotsLoading(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    fetch(`/api/slots?event_type=${selected.slug}&date=${dateStr}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots || []); setSlotsLoading(false); })
      .catch(() => setSlotsLoading(false));
  }, [selected, selectedDate]);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.target as HTMLFormElement);
    const intake: any = {};
    for (const [k, v] of fd.entries()) {
      if (k.startsWith('intake_')) intake[k.replace('intake_', '')] = v;
    }

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type_id: selected.id,
        scheduled_at: selectedSlot.iso,
        client_name: fd.get('name'),
        client_email: fd.get('email'),
        client_phone: fd.get('phone') || null,
        client_notes: fd.get('notes') || null,
        intake_data: intake,
        source: 'embed',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Booking failed');
      return;
    }
    setBooking(data.booking);
    setStep(3);
  };

  const reset = () => { setStep(0); setSelected(null); setSelectedSlot(null); setBooking(null); setSlots([]); };

  const getDays = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getFirst = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const today = new Date(); today.setHours(0,0,0,0);

  const INTAKE_FIELDS: Record<string, any> = {
    loan_purpose: { label: "Loan Purpose", type: "select", options: ["Purchase","Refinance","Cash-Out Refi","HELOC","VA IRRRL","FHA Streamline"] },
    property_type: { label: "Property Type", type: "select", options: ["Single Family","Condo","Townhome","Multi-Unit (2-4)","Investment Property"] },
    credit_range: { label: "Estimated Credit Score", type: "select", options: ["780+","740-779","700-739","660-699","620-659","Below 620","Not Sure"] },
    timeline: { label: "Timeline", type: "select", options: ["Immediately","1-3 months","3-6 months","6-12 months","Just exploring"] },
    income_range: { label: "Income Range", type: "select", options: ["Under $75K","$75K-$100K","$100K-$150K","$150K-$250K","$250K+","Prefer not to say"] },
    employment_status: { label: "Employment", type: "select", options: ["W-2 Employee","Self-Employed","1099 Contractor","Retired","Active Military/Veteran"] },
    company_size: { label: "Company Size", type: "select", options: ["Solo/1 person","2-10","11-50","51-200","200+"] },
    current_crm: { label: "Current CRM", type: "text", placeholder: "e.g. Salesforce, None" },
    goals: { label: "Primary Goals", type: "textarea", placeholder: "What are you looking to achieve?" },
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 18px', color: '#d0e8e4', minHeight: '100vh' }}>
      <style>{`
        .hs-input{width:100%;padding:10px 14px;border-radius:10px;border:1px solid #1a2e33;background:#060d10;color:#d0e8e4;font-size:13px;font-family:inherit;outline:none;transition:border-color 0.15s}
        .hs-input:focus{border-color:#00d4aa}
        .hs-input::placeholder{color:#3a5a5f}
        .hs-card{background:#0c1518;border:1px solid #162226;border-radius:14px;transition:border-color 0.2s}
        .hs-card:hover{border-color:#1e3a3f}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {['Service', 'Date & Time', 'Your Info', 'Confirmed'].map((l, i) => (
          <div key={l} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 3, borderRadius: 2, background: i <= step ? '#00d4aa' : '#1a2e33', marginBottom: 5, transition: 'all 0.3s' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: i <= step ? '#00d4aa' : '#2a4a4f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#2a4a4f' }}>Loading...</div>
      ) : step === 0 ? (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.02em' }}>Book an Appointment</h1>
          <p style={{ fontSize: 13, color: '#3a5a5f', marginBottom: 24 }}>Select a service to get started.</p>
          {eventTypes.map((t, i) => (
            <button key={t.id} onClick={() => { setSelected(t); setStep(1); }}
              className="hs-card" style={{ display: 'block', width: '100%', textAlign: 'left', padding: 18, marginBottom: 8, cursor: 'pointer', borderLeft: `4px solid ${t.color}`, animation: `slideUp 0.3s ease ${i * 0.06}s both` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#d0e8e4' }}>{t.icon} {t.name}</div>
                  <div style={{ fontSize: 12, color: '#3a5a5f', marginTop: 4 }}>{t.duration_mins} min · {t.description}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.color, fontFamily: "'JetBrains Mono'", flexShrink: 0, marginLeft: 12 }}>
                  {t.price_cents > 0 ? `$${(t.price_cents / 100).toFixed(0)}` : 'Free'}
                </div>
              </div>
            </button>
          ))}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, color: '#1a2e33', fontFamily: "'JetBrains Mono'" }}>
            Powered by HuitSchedule · huit.ai
          </div>
        </div>
      ) : step === 1 && selected ? (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <button onClick={() => { setStep(0); setSelected(null); setSlots([]); }} style={{ background: 'none', border: 'none', color: '#3a5a5f', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0 }}>← Back</button>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pick a Time</h2>
          <p style={{ fontSize: 12, color: '#3a5a5f', marginBottom: 18 }}>{selected.icon} {selected.name} · {selected.duration_mins} min</p>

          {/* Calendar */}
          <div className="hs-card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid #162226', color: '#00d4aa', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>‹</button>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid #162226', color: '#00d4aa', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
              {DAYS_SHORT.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 600, color: '#2a4a4f', padding: 5 }}>{d}</div>)}
              {Array.from({ length: getFirst(currentMonth) }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: getDays(currentMonth) }).map((_, i) => {
                const day = i + 1;
                const thisDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                thisDate.setHours(0,0,0,0);
                const isPast = thisDate < today;
                const isSel = thisDate.toDateString() === selectedDate.toDateString();
                return (
                  <button key={day} disabled={isPast} onClick={() => { setSelectedDate(thisDate); setSelectedSlot(null); }}
                    style={{ padding: 7, borderRadius: 7, border: isSel ? '2px solid #00d4aa' : '2px solid transparent', background: isSel ? 'rgba(0,212,170,0.15)' : 'transparent', color: isPast ? '#1a2e33' : isSel ? '#00d4aa' : '#7ab8ad', cursor: isPast ? 'default' : 'pointer', fontSize: 12, fontWeight: isSel ? 700 : 400 }}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots */}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#7ab8ad', marginBottom: 10 }}>
            {DAYS_FULL[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}
          </h3>
          {slotsLoading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#2a4a4f', fontSize: 12 }}>Loading slots...</div>
          ) : slots.length === 0 ? (
            <div className="hs-card" style={{ padding: 30, textAlign: 'center', color: '#2a4a4f', fontSize: 12 }}>No available times on this date</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
              {slots.map((s: any) => (
                <button key={s.time} onClick={() => { setSelectedSlot(s); setStep(2); }}
                  className="hs-card" style={{ padding: '9px 6px', textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#d0e8e4' }}>
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : step === 2 && selected && selectedSlot ? (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#3a5a5f', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0 }}>← Back</button>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Your Information</h2>
          <p style={{ fontSize: 12, color: '#3a5a5f', marginBottom: 18 }}>
            {selected.icon} {selected.name} · {DAYS_FULL[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()} at {selectedSlot.time}
          </p>
          {error && <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>}
          <div className="hs-card" style={{ padding: 20 }}>
            <form onSubmit={submitBooking}>
              {[
                { name: 'name', label: 'Full Name *', type: 'text', ph: 'Jane Smith', req: true },
                { name: 'email', label: 'Email *', type: 'email', ph: 'jane@example.com', req: true },
                { name: 'phone', label: 'Phone', type: 'tel', ph: '(907) 555-1234' },
              ].map(f => (
                <div key={f.name} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#5a8a80', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input name={f.name} type={f.type} placeholder={f.ph} required={f.req} className="hs-input" />
                </div>
              ))}
              {selected.requires_intake && (selected.intake_fields || []).map((fk: string) => {
                const def = INTAKE_FIELDS[fk];
                if (!def) return null;
                return (
                  <div key={fk} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#5a8a80', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{def.label}</label>
                    {def.type === 'select' ? (
                      <select name={`intake_${fk}`} className="hs-input"><option value="">Select...</option>{def.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                    ) : def.type === 'textarea' ? (
                      <textarea name={`intake_${fk}`} className="hs-input" rows={2} placeholder={def.placeholder} style={{ resize: 'vertical' }} />
                    ) : (
                      <input name={`intake_${fk}`} type="text" className="hs-input" placeholder={def.placeholder} />
                    )}
                  </div>
                );
              })}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#5a8a80', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea name="notes" className="hs-input" rows={2} placeholder="Anything we should know?" style={{ resize: 'vertical' }} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '13px 20px', borderRadius: 10, border: 'none', background: '#00d4aa', color: '#060d10', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {selected.price_cents > 0 ? `Confirm & Pay $${(selected.price_cents / 100).toFixed(0)}` : 'Confirm Booking'}
              </button>
            </form>
          </div>
        </div>
      ) : step === 3 && booking ? (
        <div style={{ textAlign: 'center', padding: '36px 0', animation: 'slideUp 0.4s ease' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,170,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 30, border: '2px solid rgba(0,212,170,0.3)' }}>✓</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>You're Booked!</h2>
          <p style={{ fontSize: 12, color: '#3a5a5f', marginBottom: 24 }}>Confirmation sent to {booking.client_email}</p>
          <div className="hs-card" style={{ padding: 20, textAlign: 'left', maxWidth: 380, margin: '0 auto' }}>
            <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: '#3a5a5f' }}>Service</div><div style={{ fontSize: 14, fontWeight: 600 }}>{selected?.icon} {selected?.name}</div></div>
            <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: '#3a5a5f' }}>When</div><div style={{ fontSize: 14, fontWeight: 600 }}>{new Date(booking.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot?.time}</div></div>
            <div><div style={{ fontSize: 11, color: '#3a5a5f' }}>Duration</div><div style={{ fontSize: 14, fontWeight: 600 }}>{booking.duration_mins} minutes</div></div>
          </div>
          <button onClick={reset} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#00d4aa', color: '#060d10', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Book Another</button>
          <div style={{ marginTop: 20, fontSize: 10, color: '#1a2e33', fontFamily: "'JetBrains Mono'" }}>Powered by HuitSchedule · huit.ai</div>
        </div>
      ) : null}
    </div>
  );
}
