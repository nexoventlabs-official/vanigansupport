import React from 'react';
import { LogOut, LayoutDashboard, FileBarChart2, ArrowLeft, MessageSquare } from 'lucide-react';

// Shared chrome (sidebar + topbar) for the authenticated admin pages.
// Every admin route renders inside this shell so logout / nav are consistent.
export default function AdminShell({ active, onNavigate, onLogout, title, children, onBack }) {
  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-800">
      <aside className="w-60 shrink-0 bg-wati-text text-white flex flex-col">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-wati-primary flex items-center justify-center font-bold">V</div>
          <div>
            <div className="text-[13px] font-semibold">Vanigan</div>
            <div className="text-[11px] opacity-70">Admin Panel</div>
          </div>
        </div>
        <nav className="flex-1 py-3 space-y-0.5">
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={active === 'dashboard'}
            onClick={() => onNavigate('/admin/dashboard')}
          />
          <NavItem
            icon={FileBarChart2}
            label="Reports"
            active={active === 'reports'}
            onClick={() => onNavigate('/admin/reports')}
          />
          <a
            href="/"
            className="flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] hover:bg-white/5 transition-colors"
          >
            <MessageSquare size={16} />
            <span>Chat panel</span>
          </a>
        </nav>
        <button
          onClick={onLogout}
          className="m-3 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[13px]"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="px-6 py-3 border-b bg-white flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="font-semibold text-[16px] flex-1">{title}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-colors ' +
        (active
          ? 'bg-wati-primary text-white'
          : 'hover:bg-white/5 text-white/85')
      }
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
