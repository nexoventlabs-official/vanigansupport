import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, Calendar, History, StickyNote, Globe2 } from 'lucide-react';
import AdminShell from './AdminShell.jsx';
import { Admin } from '../api/client';
import { CALL_STATUSES, statusColor } from '../utils/callStatus';
import { ist } from '../utils/time';
import { formatPhone, resolveCountry } from '../utils/country';

const STATUS_LABEL = Object.fromEntries(CALL_STATUSES.map((s) => [s.value, s.label]));

export default function AdminContactDetail({ contactId, onBack, onLogout }) {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Admin.getContact(contactId)
      .then((c) => { if (!cancelled) setContact(c); })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.data?.error || e.message || 'Failed to load contact');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contactId]);

  const country = contact ? resolveCountry(contact.waId) : null;

  const callHistory = contact?.callStatusHistory
    ? [...contact.callStatusHistory].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )
    : [];

  const notes = contact?.notes
    ? [...contact.notes].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )
    : [];

  return (
    <AdminShell
      active="dashboard"
      onNavigate={() => {}}
      onLogout={onLogout}
      onBack={onBack}
      title={contact ? (contact.name || contact.profileName || `+${contact.waId}`) : 'Contact'}
    >
      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      ) : !contact ? null : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left column - identity & meta */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="text-lg font-semibold">{contact.name || contact.profileName || '(unnamed)'}</div>
              {contact.profileName && contact.profileName !== contact.name && (
                <div className="text-[12.5px] text-gray-500 mt-0.5">WhatsApp name: {contact.profileName}</div>
              )}
              <div className="mt-4 space-y-2.5 text-[13.5px]">
                <Row icon={Phone} label="Mobile">
                  <a href={`tel:+${String(contact.waId).replace(/\D/g, '')}`} className="hover:underline font-mono">
                    {formatPhone(contact.waId)}
                  </a>
                </Row>
                {country?.name && (
                  <Row icon={Globe2} label="Country">{country.name}</Row>
                )}
                <Row icon={Calendar} label="First message">
                  {contact.firstMessageAt
                    ? ist(contact.firstMessageAt).format('DD MMM YYYY, h:mm A')
                    : '—'}
                </Row>
                <Row icon={Calendar} label="Last activity">
                  {contact.lastMessageAt
                    ? ist(contact.lastMessageAt).format('DD MMM YYYY, h:mm A')
                    : '—'}
                </Row>
                <Row icon={MessageCircle} label="Current call status">
                  <span
                    className={
                      'inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ' +
                      (statusColor[contact.callStatus || 'none'] || 'bg-gray-100 text-gray-700')
                    }
                  >
                    {STATUS_LABEL[contact.callStatus || 'none'] || contact.callStatus || '—'}
                  </span>
                </Row>
              </div>
              {contact.firstMessagePreview && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">First message text</div>
                  <div className="text-[13px] text-gray-700 break-words">
                    {contact.firstMessagePreview}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column - histories */}
          <div className="lg:col-span-2 space-y-5">
            <Section icon={History} title="Call status history" count={callHistory.length}>
              {callHistory.length === 0 ? (
                <Empty>No status changes yet.</Empty>
              ) : (
                <ol className="relative border-l-2 border-gray-200 ml-2 pl-5 space-y-3.5 py-1">
                  {callHistory.map((h, idx) => (
                    <li key={String(h._id || idx)} className="relative">
                      <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-wati-primary ring-4 ring-white" />
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={
                            'text-[13px] px-2 py-0.5 rounded font-medium ' +
                            (statusColor[h.status] || 'bg-gray-100 text-gray-700')
                          }
                        >
                          {STATUS_LABEL[h.status] || h.status || '—'}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] uppercase tracking-wide text-wati-primary font-semibold">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5">
                        {h.createdAt ? ist(h.createdAt).format('DD MMM YYYY, h:mm A') : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section icon={StickyNote} title="Internal notes" count={notes.length}>
              {notes.length === 0 ? (
                <Empty>No notes yet.</Empty>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n, idx) => (
                    <li
                      key={String(n._id || idx)}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                    >
                      <div className="text-[13.5px] text-gray-800 whitespace-pre-wrap break-words">
                        {n.text}
                      </div>
                      <div className="text-[11.5px] text-yellow-800/80 mt-1.5 font-medium">
                        {n.createdAt ? ist(n.createdAt).format('DD MMM YYYY, h:mm A') : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">{label}</div>
        <div className="mt-0.5 text-gray-800">{children}</div>
      </div>
    </div>
  );
}
function Section({ icon: Icon, title, count, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b">
        <Icon size={16} className="text-wati-primary" />
        <div className="font-medium">{title}</div>
        {typeof count === 'number' && (
          <span className="text-[12px] text-gray-500">({count})</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function Empty({ children }) {
  return (
    <div className="text-[13px] text-gray-400 italic border-2 border-dashed border-gray-200 rounded-lg py-6 text-center">
      {children}
    </div>
  );
}
