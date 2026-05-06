import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronRight, RefreshCw } from 'lucide-react';
import AdminShell from './AdminShell.jsx';
import { Admin } from '../api/client';
import { CALL_STATUSES, statusColor } from '../utils/callStatus';
import { ist } from '../utils/time';
import { formatPhone } from '../utils/country';

const STATUS_LABEL = Object.fromEntries(CALL_STATUSES.map((s) => [s.value, s.label]));

export default function AdminDashboard({ onNavigate, onLogout }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await Admin.listContacts();
      setContacts(list);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const re = q.trim() ? new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    return contacts.filter((c) => {
      if (statusFilter !== 'all' && (c.callStatus || 'none') !== statusFilter) return false;
      if (!re) return true;
      return (
        re.test(c.name || '') ||
        re.test(c.profileName || '') ||
        re.test(c.waId || '')
      );
    });
  }, [contacts, q, statusFilter]);

  // Quick stats over the unfiltered list so the cards don't shift while typing.
  const stats = useMemo(() => {
    const total = contacts.length;
    const interested = contacts.filter((c) => c.callStatus === 'interested').length;
    const notInterested = contacts.filter((c) => c.callStatus === 'not_interested').length;
    const pending = contacts.filter((c) => !c.callStatus || c.callStatus === 'none').length;
    return { total, interested, notInterested, pending };
  }, [contacts]);

  return (
    <AdminShell
      active="dashboard"
      onNavigate={onNavigate}
      onLogout={onLogout}
      title="Dashboard"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total contacts" value={stats.total} accent="bg-blue-50 text-blue-700" />
        <StatCard label="Interested" value={stats.interested} accent="bg-green-50 text-green-700" />
        <StatCard label="Not interested" value={stats.notInterested} accent="bg-red-50 text-red-700" />
        <StatCard label="No status yet" value={stats.pending} accent="bg-yellow-50 text-yellow-700" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or mobile…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 outline-none focus:bg-white focus:border-wati-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-wati-primary"
          >
            <option value="all">All statuses</option>
            {CALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 text-[13px] text-red-700 bg-red-50 border-b border-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[12px] uppercase tracking-wide text-gray-500">
              <tr>
                <Th>Contact</Th>
                <Th>Mobile</Th>
                <Th>Call status</Th>
                <Th>First message</Th>
                <Th>Last message</Th>
                <Th>Notes</Th>
                <Th>Status changes</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && contacts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No contacts found</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => onNavigate(`/admin/contacts/${c._id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <Td>
                      <div className="font-medium text-gray-900">
                        {c.name || c.profileName || '(unnamed)'}
                      </div>
                      {c.profileName && c.profileName !== c.name && (
                        <div className="text-[11.5px] text-gray-500 truncate">
                          WA: {c.profileName}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono text-[13px]">{formatPhone(c.waId)}</span>
                    </Td>
                    <Td>
                      <span
                        className={
                          'inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ' +
                          (statusColor[c.callStatus || 'none'] || 'bg-gray-100 text-gray-700')
                        }
                      >
                        {STATUS_LABEL[c.callStatus || 'none'] || c.callStatus || '—'}
                      </span>
                    </Td>
                    <Td>{c.firstMessageAt ? ist(c.firstMessageAt).format('DD MMM, h:mm A') : '—'}</Td>
                    <Td>{c.lastMessageAt ? ist(c.lastMessageAt).format('DD MMM, h:mm A') : '—'}</Td>
                    <Td className="text-center">{(c.notes || []).length}</Td>
                    <Td className="text-center">{(c.callStatusHistory || []).length}</Td>
                    <Td className="text-right pr-3">
                      <ChevronRight size={16} className="inline text-gray-400" />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function Th({ children, ...rest }) {
  return <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap" {...rest}>{children}</th>;
}
function Td({ children, className = '', ...rest }) {
  return <td className={'px-3 py-2.5 align-middle whitespace-nowrap ' + className} {...rest}>{children}</td>;
}
function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-[12px] uppercase tracking-wide text-gray-500 font-medium">{label}</div>
      <div className={'mt-1.5 text-2xl font-semibold ' + (accent || '').replace('bg-', 'text-').replace('text-blue-50', '').replace('text-green-50', '').replace('text-red-50', '').replace('text-yellow-50', '')}>
        {value}
      </div>
    </div>
  );
}
