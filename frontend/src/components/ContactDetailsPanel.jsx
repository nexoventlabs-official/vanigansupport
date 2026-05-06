import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Phone,
  MessageCircle,
  Tag,
  Calendar,
  Globe2,
  Megaphone,
  StickyNote,
  Hash,
  X,
  Clock,
} from 'lucide-react';
import { Messages } from '../api/client';
import { socket } from '../api/socket';
import { resolveCountry, formatPhone } from '../utils/country';
import { ist, windowState, formatCountdown } from '../utils/time';
import { CALL_STATUSES } from '../utils/callStatus';
import ChannelIcon, { getSourceMeta } from './ChannelIcon.jsx';
import CountryFlag from './CountryFlag.jsx';
import Avatar from './Avatar.jsx';
import NotesDialog from './NotesDialog.jsx';

function Field({ icon: Icon, label, children, border = true }) {
  if (!children) return null;
  return (
    <div className={clsx("py-3 px-5 flex gap-4", border && "border-b border-gray-100")}>
      {Icon && <div className="mt-0.5 text-wati-muted/70"><Icon size={20} strokeWidth={1.5} /></div>}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-wati-text break-words leading-tight">{children}</div>
        <div className="text-[13px] text-wati-muted mt-1">{label}</div>
      </div>
    </div>
  );
}

// Pull the earliest (first) inbound message timestamp from the chat history.
// Used to show "Customer started chat on …" in the details panel.
function findFirstInboundAt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  // messages are ordered ascending by (createdAt, seq) in the chat panel; even
  // if not, do a defensive scan.
  let earliest = null;
  for (const m of messages) {
    if (m.direction !== 'inbound') continue;
    const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
    if (!earliest || t < earliest.time) earliest = { time: t, msg: m };
  }
  return earliest?.msg || null;
}

export default function ContactDetailsPanel({ contact, onClose, onContactUpdate }) {
  const [firstMessage, setFirstMessage] = useState(null);
  const [, tick] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);

  // Tick every minute so the "started X ago" relative time stays fresh.
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Fetch the chat history once per contact to identify the FIRST inbound
  // message. We refresh on socket events so a freshly-arriving first message
  // is reflected in the panel.
  useEffect(() => {
    if (!contact?._id) {
      setFirstMessage(null);
      return;
    }
    let cancelled = false;
    Messages.list(contact._id).then((list) => {
      if (cancelled) return;
      setFirstMessage(findFirstInboundAt(list));
    });
    const onAny = (m) => {
      if (!m || String(m.contact) !== String(contact._id)) return;
      if (m.direction !== 'inbound') return;
      setFirstMessage((prev) => {
        if (!prev) return m;
        return new Date(m.createdAt) < new Date(prev.createdAt) ? m : prev;
      });
    };
    const onCleared = ({ contactId }) => {
      if (String(contactId) === String(contact._id)) setFirstMessage(null);
    };
    socket.on('message:new', onAny);
    socket.on('chat:cleared', onCleared);
    return () => {
      cancelled = true;
      socket.off('message:new', onAny);
      socket.off('chat:cleared', onCleared);
    };
  }, [contact?._id]);

  const country = useMemo(() => resolveCountry(contact?.waId), [contact?.waId]);
  const ws = useMemo(
    () => windowState(contact?.lastCustomerMessageAt, contact?.source),
    [contact?.lastCustomerMessageAt, contact?.source]
  );

  if (!contact) return null;

  const displayName = contact.name || contact.profileName || `+${contact.waId}`;
  const callStatusLabel =
    CALL_STATUSES.find((s) => s.value === (contact.callStatus || 'none'))?.label
    || contact.callStatus
    || '—';
  // "Customer started chat" = the moment this contact first reached out. Prefer
  // the first inbound message we have on record; fall back to the CTWA referral
  // capture time, and finally to when the contact record was created.
  const startedAtIso = firstMessage?.createdAt || contact.referral?.capturedAt || contact.createdAt;
  const startedAt = startedAtIso ? ist(startedAtIso) : null;

  // Notes history - newest first. Falls back to the legacy single `comment`
  // field for contacts created before the notes[] migration.
  const noteEntries = Array.isArray(contact.notes) ? [...contact.notes] : [];
  if (noteEntries.length === 0 && contact.comment) {
    noteEntries.push({
      _id: 'legacy',
      text: contact.comment,
      createdAt: contact.updatedAt || contact.createdAt,
      __legacy: true,
    });
  }
  noteEntries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const latestNote = noteEntries[0] || null;

  return (
    <aside className="w-[22rem] shrink-0 bg-[#f0f2f5] border-l border-gray-200 flex flex-col h-full z-10">
      {/* Header / cover banner */}
      <div className="bg-white shadow-sm pb-5 relative shrink-0">
        <div
          className="relative h-28 bg-cover bg-center"
          style={{ backgroundImage: 'url(/banner.png)' }}
        >
          <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors backdrop-blur-sm"
              title="Close details"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex flex-col items-center -mt-12 relative z-10 px-4">
          <Avatar
            name={displayName}
            url={contact.profilePicUrl}
            size={96}
            className="ring-4 ring-white shadow-sm"
          />
          <div className="mt-3 text-[19px] font-medium text-wati-text flex items-center gap-2 text-center break-words max-w-full">
            <span className="truncate">{displayName}</span>
          </div>
          <div className="text-[14px] text-wati-muted mt-1 flex items-center gap-1.5">
            <a href={`tel:+${String(contact.waId).replace(/\D/g, '')}`} className="hover:underline">
              {formatPhone(contact.waId)}
            </a>
            <span className="text-gray-300">•</span>
            <span className="flex items-center gap-1">
              {country.iso2 && <CountryFlag iso2={country.iso2} emoji={country.flag} size={14} />}
              {country.name}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable details grouped in cards */}
      <div className="flex-1 overflow-y-auto thin-scroll pb-6">
        
        {/* Card 1: Chat Meta */}
        <div className="bg-white shadow-sm mt-2 py-1">
          {contact.profileName && contact.profileName !== contact.name && (
            <Field icon={Tag} label="WhatsApp profile name">
              {contact.profileName}
            </Field>
          )}
          <Field icon={Calendar} label="Customer started chat">
            {startedAt ? (
              <div>
                <div className="font-medium">{startedAt.format('DD MMM YYYY, h:mm A')}</div>
                <div className="text-[12px] text-wati-muted font-normal">{startedAt.fromNow()}</div>
              </div>
            ) : (
              <span className="text-wati-muted italic text-[14px]">No messages yet</span>
            )}
          </Field>
          <Field icon={Clock} label={`${ws.totalHours}h customer-service window`} border={false}>
            {ws.expired ? (
              <span className="text-red-600 font-medium">Window closed — templates only</span>
            ) : !contact.lastCustomerMessageAt ? (
              <span className="text-wati-muted italic text-[14px]">No customer message yet</span>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'font-mono font-medium px-2 py-0.5 rounded text-[13px]',
                    ws.danger
                      ? 'bg-red-50 text-red-700 animate-pulse'
                      : 'bg-green-50 text-green-700'
                  )}
                >
                  {formatCountdown(ws.remainingMs)}
                </span>
                <span className="text-[12px] text-wati-muted">remaining</span>
              </div>
            )}
          </Field>
        </div>

        {/* Card 2: Acquisition & Status */}
        <div className="bg-white shadow-sm mt-2 py-1">
          <Field icon={Globe2} label="Acquisition Source">
            <span className="inline-flex items-center gap-2 font-medium">
              <ChannelIcon source={contact.source} size={20} />
              <span>{getSourceMeta(contact.source).label}</span>
            </span>
          </Field>

          {(contact.source === 'facebook_ad' || contact.source === 'instagram_ad') && contact.referral && (
            <Field icon={Megaphone} label="Ad details">
              {contact.referral.headline && (
                <div className="font-medium text-[14px]">{contact.referral.headline}</div>
              )}
              {contact.referral.body && (
                <div className="text-[13px] text-wati-muted mt-1 line-clamp-2">{contact.referral.body}</div>
              )}
              {contact.referral.source_url && (
                <a
                  href={contact.referral.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-1 text-[13px] text-wati-primary hover:underline truncate"
                >
                  View source link
                </a>
              )}
            </Field>
          )}

          <Field icon={MessageCircle} label="Call status" border={false}>
            {callStatusLabel}
          </Field>
        </div>

        {/* Card 3: Internal Notes */}
        <div className="bg-white shadow-sm mt-2 px-5 py-4">
          <div className="flex items-center justify-between text-[14px] text-wati-muted font-medium mb-3">
            <div className="flex items-center gap-2">
              <StickyNote size={18} strokeWidth={1.5} /> 
              <span>Internal notes {noteEntries.length > 0 && `(${noteEntries.length})`}</span>
            </div>
            <button
              onClick={() => setNotesOpen(true)}
              className="text-wati-primary hover:underline text-[13px] font-normal"
            >
              View all
            </button>
          </div>
          
          <button
            onClick={() => setNotesOpen(true)}
            className="w-full text-left outline-none"
          >
            {latestNote ? (
              <div className="bg-[#fff9c4] border border-[#f5eb9d] rounded-lg p-3 hover:bg-[#fff59d] transition-colors shadow-sm">
                <div className="text-yellow-900 text-[14px] whitespace-pre-wrap break-words line-clamp-3">
                  {latestNote.text}
                </div>
                <div className="text-[11px] text-yellow-700/80 mt-2 flex items-center gap-1.5 font-medium">
                  {latestNote.createdAt
                    ? ist(latestNote.createdAt).format('DD MMM YYYY, h:mm A')
                    : ''}
                  {noteEntries.length > 1 && (
                    <span>• +{noteEntries.length - 1} older</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-wati-muted italic border-2 border-dashed border-gray-200 rounded-lg p-3 text-center hover:bg-gray-50 transition-colors">
                No notes yet — click to add one
              </div>
            )}
          </button>
        </div>

        {/* Meta */}
        <div className="mt-4 text-center">
          <div className="text-[11px] text-wati-muted flex justify-center items-center gap-1.5">
             <Hash size={12} /> Contact ID: <code className="bg-black/5 px-1 rounded">{contact._id}</code>
          </div>
        </div>
      </div>

      {notesOpen && (
        <NotesDialog
          contact={contact}
          onClose={() => setNotesOpen(false)}
          onContactUpdate={onContactUpdate}
        />
      )}
    </aside>
  );
}
