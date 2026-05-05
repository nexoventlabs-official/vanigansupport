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

function Field({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-wati-muted">
        {Icon && <Icon size={12} />}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm text-wati-text break-words">{children}</div>
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
    <aside className="w-[320px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header / cover banner */}
      <div
        className="relative h-32 bg-cover bg-center"
        style={{ backgroundImage: 'url(/banner.png)' }}
      >
        {/* subtle dark gradient at the bottom so the avatar reads cleanly
            against any banner artwork */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/10 pointer-events-none" />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/70 backdrop-blur-sm hover:bg-white text-wati-text shadow-sm"
            title="Hide details"
          >
            <X size={16} />
          </button>
        )}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <Avatar
            name={displayName}
            url={contact.profilePicUrl}
            size={96}
            className="ring-4 ring-white shadow-md"
          />
        </div>
      </div>

      {/* Identity */}
      <div className="pt-14 px-4 pb-4 text-center border-b border-gray-100">
        <div className="text-lg font-semibold text-wati-text inline-flex items-center gap-2">
          <span className="truncate">{displayName}</span>
          {country.iso2 && (
            <CountryFlag
              iso2={country.iso2}
              emoji={country.flag}
              title={country.name}
              size={18}
            />
          )}
        </div>
        <div className="text-xs text-wati-muted mt-0.5">{country.name}</div>
      </div>

      {/* Scrollable details */}
      <div className="flex-1 overflow-y-auto thin-scroll">
        <Field icon={Phone} label="Phone">
          <a
            href={`tel:+${String(contact.waId).replace(/\D/g, '')}`}
            className="text-wati-primary hover:underline"
          >
            {formatPhone(contact.waId)}
          </a>
        </Field>

        {contact.profileName && contact.profileName !== contact.name && (
          <Field icon={Tag} label="WhatsApp profile name">
            {contact.profileName}
          </Field>
        )}

        <Field icon={Globe2} label="Came via">
          <span className="inline-flex items-center gap-2">
            <ChannelIcon source={contact.source} size={22} />
            <span>{getSourceMeta(contact.source).label}</span>
            <span className="text-wati-muted text-xs">
              · {ws.totalHours}h window
            </span>
          </span>
        </Field>

        <Field icon={Calendar} label="Customer started chat">
          {startedAt ? (
            <div>
              <div className="font-medium">{startedAt.format('DD MMM YYYY, h:mm A')}</div>
              <div className="text-xs text-wati-muted">{startedAt.fromNow()}</div>
            </div>
          ) : (
            <span className="text-wati-muted text-xs">No messages yet</span>
          )}
        </Field>

        <Field icon={Clock} label={`${ws.totalHours}h customer-service window`}>
          {ws.expired ? (
            <span className="text-red-600">Window closed — only template messages allowed</span>
          ) : !contact.lastCustomerMessageAt ? (
            <span className="text-wati-muted">No customer message yet</span>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'font-mono font-semibold px-2 py-0.5 rounded border text-xs',
                  ws.danger
                    ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                    : 'bg-green-50 text-green-700 border-green-200'
                )}
              >
                {formatCountdown(ws.remainingMs)}
              </span>
              <span className="text-xs text-wati-muted">remaining</span>
            </div>
          )}
        </Field>

        <Field icon={MessageCircle} label="Call status">
          {callStatusLabel}
        </Field>

        {/* Internal notes - clickable card opens the full history dialog. We
            always render this section (even when empty) so the agent can add
            the first note without hunting for the chat-header button. */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-wati-muted">
            <div className="flex items-center gap-2">
              <StickyNote size={12} />
              <span>Internal notes</span>
              {noteEntries.length > 0 && (
                <span className="text-wati-muted normal-case tracking-normal">
                  ({noteEntries.length})
                </span>
              )}
            </div>
            <button
              onClick={() => setNotesOpen(true)}
              className="text-wati-primary hover:underline normal-case tracking-normal text-[11px]"
            >
              View all
            </button>
          </div>
          <button
            onClick={() => setNotesOpen(true)}
            className="mt-1 w-full text-left"
          >
            {latestNote ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 hover:bg-yellow-100/60 transition-colors">
                <div className="text-yellow-900 text-xs whitespace-pre-wrap break-words line-clamp-3">
                  {latestNote.text}
                </div>
                <div className="text-[10px] text-yellow-700/80 mt-1">
                  {latestNote.createdAt
                    ? ist(latestNote.createdAt).format('DD MMM YYYY, h:mm A')
                    : ''}
                  {noteEntries.length > 1 && (
                    <span> · +{noteEntries.length - 1} older</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-wati-muted italic border border-dashed border-gray-200 rounded p-2 hover:bg-gray-50">
                No notes yet — click to add one
              </div>
            )}
          </button>
        </div>

        {(contact.source === 'facebook_ad' || contact.source === 'instagram_ad') && contact.referral && (
          <Field icon={Megaphone} label="Acquired from">
            {contact.referral.headline && (
              <div className="font-medium">{contact.referral.headline}</div>
            )}
            {contact.referral.body && (
              <div className="text-xs text-wati-muted mt-1 line-clamp-3">{contact.referral.body}</div>
            )}
            {contact.referral.source_url && (
              <a
                href={contact.referral.source_url}
                target="_blank"
                rel="noreferrer"
                className="block mt-1 text-xs text-wati-primary hover:underline truncate"
              >
                {contact.referral.source_url}
              </a>
            )}
            {contact.referral.source_id && (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-wati-muted">
                <Hash size={11} /> {contact.referral.source_id}
              </div>
            )}
          </Field>
        )}

        <Field icon={Hash} label="Contact ID">
          <code className="text-xs text-wati-muted break-all">{contact._id}</code>
        </Field>
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
