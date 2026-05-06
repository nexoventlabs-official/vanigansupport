const Contact = require('../models/Contact');
const Message = require('../models/Message');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { signAdminToken } = require('../middleware/adminAuth');

// ---- Helpers ---------------------------------------------------------------

// Pretty-print an ISO/Date as "DD MMM YYYY hh:mm A" without pulling in dayjs
// on the backend (we don't have it as a dep here).
function fmt(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  let h = dt.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(dt.getDate())} ${months[dt.getMonth()]} ${dt.getFullYear()} ${h}:${pad(dt.getMinutes())} ${ampm}`;
}

// Map a callStatus enum value to a user-facing label (mirrors the frontend).
const CALL_STATUS_LABELS = {
  none: '— None —',
  first_call_completed: 'First Call Completed',
  second_call_completed: 'Second Call Completed',
  third_call_completed: 'Third Call Completed',
  switch_off: 'Switch Off',
  busy: 'Busy',
  after_call: 'After Call',
  not_interested: 'Not Interested',
  interested: 'Interested',
  hold: 'Hold',
};
const labelFor = (s) => CALL_STATUS_LABELS[s] || s || '—';

// Resolve a date range from a `preset` query param (today/week/month) or
// an explicit `from`/`to` pair. Returns { from, to } as Dates (or nulls).
function resolveRange({ preset, from, to }) {
  if (preset && preset !== 'custom') {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (preset === 'today' || preset === 'daily') {
      // start = today 00:00, end = today 23:59
    } else if (preset === 'weekly' || preset === 'week') {
      start.setDate(start.getDate() - 6); // last 7 days inclusive
    } else if (preset === 'monthly' || preset === 'month') {
      start.setDate(start.getDate() - 29); // last 30 days inclusive
    }
    return { from: start, to: end };
  }
  return {
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
  };
}

// Build the exportable rows + the per-contact "first message" timestamp.
// We do this once and feed the same rows to both Excel and PDF writers.
async function buildReportRows(range) {
  const filter = {};
  if (range.from || range.to) {
    filter.lastMessageAt = {};
    if (range.from) filter.lastMessageAt.$gte = range.from;
    if (range.to) filter.lastMessageAt.$lte = range.to;
  }
  const contacts = await Contact.find(filter)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .lean();

  // Look up first inbound message per contact in a single aggregation so we
  // don't fan out N queries.
  const ids = contacts.map((c) => c._id);
  const firstMsgs = ids.length === 0 ? [] : await Message.aggregate([
    { $match: { contact: { $in: ids }, direction: 'inbound' } },
    { $sort: { createdAt: 1 } },
    { $group: {
        _id: '$contact',
        firstAt: { $first: '$createdAt' },
        firstText: { $first: '$text' },
        firstType: { $first: '$type' },
      } },
  ]);
  const firstByContact = new Map(firstMsgs.map((r) => [String(r._id), r]));

  return contacts.map((c) => {
    const first = firstByContact.get(String(c._id));
    return {
      _id: String(c._id),
      name: c.name || c.profileName || '',
      whatsappName: c.profileName || '',
      mobile: c.waId ? `+${c.waId}` : '',
      callStatus: labelFor(c.callStatus),
      firstMessageAt: first?.firstAt || null,
      firstMessagePreview: first?.firstText || (first?.firstType ? `[${first.firstType}]` : ''),
      lastMessageAt: c.lastMessageAt || null,
      callStatusHistory: (c.callStatusHistory || []).map((h) => ({
        status: labelFor(h.status),
        at: h.createdAt,
      })),
      notes: (c.notes || []).map((n) => ({ text: n.text, at: n.createdAt })),
      comment: c.comment || '',
      source: c.source || 'whatsapp_direct',
      createdAt: c.createdAt,
    };
  });
}

// ---- Routes ----------------------------------------------------------------

// POST /api/admin/login  { username, password }  -> { token }
exports.login = (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASS || 'admin';
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== expectedUser ||
    password !== expectedPass
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({
    token: signAdminToken(username),
    user: { username, role: 'admin' },
  });
};

// GET /api/admin/me   -> { ok: true, user }
exports.me = (req, res) => {
  res.json({ ok: true, user: { username: req.admin?.sub, role: 'admin' } });
};

// GET /api/admin/contacts   -> full contact records with histories
// Optional ?q= filter by name / waId / profileName.
exports.listContacts = async (req, res) => {
  const { q, preset, from, to } = req.query;
  const filter = {};
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: re }, { waId: re }, { profileName: re }];
  }
  const range = resolveRange({ preset, from, to });
  if (range.from || range.to) {
    filter.lastMessageAt = {};
    if (range.from) filter.lastMessageAt.$gte = range.from;
    if (range.to) filter.lastMessageAt.$lte = range.to;
  }
  const contacts = await Contact.find(filter)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(1000)
    .lean();

  // Pull first-inbound timestamps in bulk so the dashboard can show
  // "First message" without a per-row query.
  const ids = contacts.map((c) => c._id);
  const firstMsgs = ids.length === 0 ? [] : await Message.aggregate([
    { $match: { contact: { $in: ids }, direction: 'inbound' } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$contact', firstAt: { $first: '$createdAt' } } },
  ]);
  const firstByContact = new Map(firstMsgs.map((r) => [String(r._id), r.firstAt]));

  res.json(
    contacts.map((c) => ({
      ...c,
      firstMessageAt: firstByContact.get(String(c._id)) || null,
    }))
  );
};

// GET /api/admin/contacts/:id   -> one contact with histories (no messages)
exports.getContact = async (req, res) => {
  const c = await Contact.findById(req.params.id).lean();
  if (!c) return res.status(404).json({ error: 'Not found' });
  const first = await Message.findOne({ contact: c._id, direction: 'inbound' })
    .sort({ createdAt: 1 })
    .lean();
  res.json({
    ...c,
    firstMessageAt: first?.createdAt || null,
    firstMessagePreview: first?.text || (first?.type ? `[${first.type}]` : ''),
  });
};

// GET /api/admin/report?format=xlsx|pdf&preset=daily|weekly|monthly|custom&from=&to=
// Streams the report file as an attachment download.
exports.downloadReport = async (req, res) => {
  const { format = 'xlsx', preset = 'monthly', from, to } = req.query;
  const range = resolveRange({ preset, from, to });
  const rows = await buildReportRows(range);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `vanigan-report-${preset}-${stamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

  if (format === 'pdf') {
    return streamPdf(res, rows, range, filename);
  }
  return streamExcel(res, rows, range, filename);
};

// --- Excel writer -----------------------------------------------------------
async function streamExcel(res, rows, range, filename) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vanigan Support';
  wb.created = new Date();

  // "— None —" looks awkward in a spreadsheet; show "N/A" instead.
  const cellStatus = (label) => (!label || label === '— None —' ? 'N/A' : label);

  // Sheet 1: summary, one row per contact
  const ws = wb.addWorksheet('Contacts');
  ws.columns = [
    { header: 'Name',                 key: 'name',                 width: 24 },
    { header: 'WhatsApp Name',        key: 'whatsappName',         width: 22 },
    { header: 'Mobile',               key: 'mobile',               width: 18 },
    { header: 'Source',               key: 'source',               width: 16 },
    { header: 'Current Call Status',  key: 'callStatus',           width: 22 },
    { header: 'First Message At',     key: 'firstMessageAt',       width: 24 },
    { header: 'Last Message At',      key: 'lastMessageAt',        width: 24 },
    { header: 'Call Status Changes',  key: 'callStatusHistoryStr', width: 50 },
    { header: 'Notes',                key: 'notesStr',             width: 50 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22A06B' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const r of rows) {
    ws.addRow({
      name: r.name,
      whatsappName: r.whatsappName,
      mobile: r.mobile,
      source: r.source,
      callStatus: cellStatus(r.callStatus),
      firstMessageAt: fmt(r.firstMessageAt),
      lastMessageAt: fmt(r.lastMessageAt),
      // Use "\n" so that with wrapText each entry renders on its own line
      // inside the cell, prefixed with a bullet for readability.
      callStatusHistoryStr: r.callStatusHistory
        .map((h) => `• ${cellStatus(h.status)} @ ${fmt(h.at)}`)
        .join('\n'),
      notesStr: r.notes
        .map((n) => `• [${fmt(n.at)}] ${n.text}`)
        .join('\n'),
    });
  }
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });

  // Sheet 2: full call-status timeline (long format)
  const tl = wb.addWorksheet('Call Status Timeline');
  tl.columns = [
    { header: 'Name',   key: 'name',   width: 24 },
    { header: 'Mobile', key: 'mobile', width: 18 },
    { header: 'Status', key: 'status', width: 24 },
    { header: 'At',     key: 'at',     width: 24 },
  ];
  tl.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  tl.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22A06B' } };
  for (const r of rows) {
    for (const h of r.callStatusHistory) {
      tl.addRow({ name: r.name || r.mobile, mobile: r.mobile, status: cellStatus(h.status), at: fmt(h.at) });
    }
  }

  // Sheet 3: notes timeline
  const nt = wb.addWorksheet('Notes Timeline');
  nt.columns = [
    { header: 'Name',   key: 'name',   width: 24 },
    { header: 'Mobile', key: 'mobile', width: 18 },
    { header: 'Note',   key: 'note',   width: 60 },
    { header: 'At',     key: 'at',     width: 24 },
  ];
  nt.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  nt.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22A06B' } };
  for (const r of rows) {
    for (const n of r.notes) {
      nt.addRow({ name: r.name || r.mobile, mobile: r.mobile, note: n.text, at: fmt(n.at) });
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// --- PDF writer -------------------------------------------------------------
function streamPdf(res, rows, range, filename) {
  const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Title block
  doc.fontSize(18).fillColor('#22A06B').text('Vanigan Support — Contact Report', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#444');
  const rangeLabel = range.from || range.to
    ? `Range: ${range.from ? fmt(range.from) : '—'}  to  ${range.to ? fmt(range.to) : '—'}`
    : 'Range: All time';
  doc.text(rangeLabel);
  doc.text(`Generated: ${fmt(new Date())}   |   Contacts: ${rows.length}`);
  doc.moveDown(0.6);

  for (const r of rows) {
    // Stop near the bottom of the page and start a new one
    if (doc.y > doc.page.height - 120) doc.addPage();

    doc.fontSize(12).fillColor('#111').text(`${r.name || '(unnamed)'}    ${r.mobile}`);
    doc.fontSize(9).fillColor('#555').text(
      `Source: ${r.source}    |    Current status: ${r.callStatus}    |    First msg: ${fmt(r.firstMessageAt) || '—'}    |    Last msg: ${fmt(r.lastMessageAt) || '—'}`
    );
    if (r.firstMessagePreview) {
      doc.fontSize(9).fillColor('#666').text(`First message: ${r.firstMessagePreview}`, { width: 720 });
    }

    if (r.callStatusHistory.length > 0) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor('#22A06B').text('Call status history:');
      doc.fontSize(9).fillColor('#333');
      for (const h of r.callStatusHistory) {
        doc.text(`  • ${h.status}  —  ${fmt(h.at)}`);
      }
    }

    if (r.notes.length > 0) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor('#22A06B').text('Internal notes:');
      doc.fontSize(9).fillColor('#333');
      for (const n of r.notes) {
        doc.text(`  • [${fmt(n.at)}]  ${n.text}`, { width: 720 });
      }
    } else if (r.comment) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor('#22A06B').text('Comment:');
      doc.fontSize(9).fillColor('#333').text(`  • ${r.comment}`, { width: 720 });
    }

    doc.moveDown(0.4);
    doc.strokeColor('#dddddd').lineWidth(0.5)
      .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);
  }

  doc.end();
}
