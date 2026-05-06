import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import AdminShell from './AdminShell.jsx';
import { Admin } from '../api/client';

const PRESETS = [
  { value: 'today',   label: 'Today' },
  { value: 'weekly',  label: 'Last 7 days' },
  { value: 'monthly', label: 'Last 30 days' },
  { value: 'custom',  label: 'Custom range' },
];

export default function AdminReports({ onNavigate, onLogout }) {
  const [preset, setPreset] = useState('monthly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState('xlsx'); // 'xlsx' | 'pdf'
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const customInvalid = useMemo(() => preset === 'custom' && (!from || !to || from > to), [preset, from, to]);

  async function handleDownload() {
    setError('');
    setDownloading(true);
    try {
      const params = { format, preset };
      if (preset === 'custom') {
        params.from = new Date(from + 'T00:00:00').toISOString();
        params.to = new Date(to + 'T23:59:59.999').toISOString();
      }
      const blob = await Admin.downloadReport(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vanigan-report-${preset}-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AdminShell active="reports" onNavigate={onNavigate} onLogout={onLogout} title="Reports">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-[15px] font-semibold mb-1">Download contact report</h2>
          <p className="text-[13px] text-gray-500 mb-5">
            Includes name, mobile, current call status, full status-change history,
            internal notes, and first-message timestamp for every contact.
          </p>

          {/* Range presets */}
          <Label>Date range</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={
                  'px-3 py-2 text-[13px] rounded-lg border transition-colors ' +
                  (preset === p.value
                    ? 'bg-wati-primary text-white border-wati-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-wati-primary/40')
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label>From</Label>
                <DateInput value={from} onChange={setFrom} />
              </div>
              <div>
                <Label>To</Label>
                <DateInput value={to} onChange={setTo} />
              </div>
            </div>
          )}

          {/* Format */}
          <Label>Format</Label>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <FormatBtn
              icon={FileSpreadsheet}
              label="Excel (.xlsx)"
              active={format === 'xlsx'}
              onClick={() => setFormat('xlsx')}
            />
            <FormatBtn
              icon={FileText}
              label="PDF"
              active={format === 'pdf'}
              onClick={() => setFormat('pdf')}
            />
          </div>

          {error && (
            <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading || customInvalid}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-wati-primary hover:bg-wati-primaryDark text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {downloading ? 'Preparing…' : `Download ${format === 'pdf' ? 'PDF' : 'Excel'} report`}
          </button>
          {customInvalid && (
            <div className="text-[12px] text-red-600 mt-2">
              Please pick a valid From/To range.
            </div>
          )}
        </div>

        <div className="text-[12px] text-gray-500 mt-4 leading-relaxed">
          The Excel file contains three sheets: a one-row-per-contact summary,
          a Call Status Timeline (one row per change), and a Notes Timeline
          (one row per note). PDF format produces a printable list.
        </div>
      </div>
    </AdminShell>
  );
}

function Label({ children }) {
  return <div className="text-[12px] uppercase tracking-wide font-medium text-gray-500 mb-1.5">{children}</div>;
}

function DateInput({ value, onChange }) {
  return (
    <div className="relative">
      <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-8 pr-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 outline-none focus:bg-white focus:border-wati-primary"
      />
    </div>
  );
}

function FormatBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-colors ' +
        (active
          ? 'bg-wati-primary text-white border-wati-primary'
          : 'bg-white text-gray-700 border-gray-200 hover:border-wati-primary/40')
      }
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
