import { useEffect, useState } from 'react';
import {
  Settings,
  ListChecks,
  Wand2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { api, getAdminToken, clearAdminToken } from '../lib/api';
import { cn } from '../lib/utils';
import { LoginForm } from '../components/admin/LoginForm';
import { ConfigForm } from '../components/admin/ConfigForm';
import { SessionTable } from '../components/admin/SessionTable';
import { ManualShare } from '../components/admin/ManualShare';

type Tab = 'config' | 'sessions' | 'manual';

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'config', label: '配置', icon: Settings },
  { id: 'sessions', label: '分享记录', icon: ListChecks },
  { id: 'manual', label: '手动开放', icon: Wand2 },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [checking, setChecking] = useState(!!getAdminToken());
  const [tab, setTab] = useState<Tab>('config');

  useEffect(() => {
    if (!authed) return;
    api
      .getAdminConfig()
      .then(() => setChecking(false))
      .catch(() => {
        clearAdminToken();
        setAuthed(false);
        setChecking(false);
      });
  }, [authed]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ShieldCheck className="w-8 h-8 text-brand animate-pulse" />
      </div>
    );
  }

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />;
  }

  const handleLogout = () => {
    clearAdminToken();
    setAuthed(false);
  };

  return (
    <div className="min-h-screen flex">
      <aside className="fixed left-0 top-0 bottom-0 w-60 glass-strong flex flex-col py-6 px-4 z-10">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-dark to-brand flex items-center justify-center text-xl">
            🐑
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Xgoat.Cast</p>
            <p className="text-xs text-dim">管理后台</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  tab === t.id
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-muted hover:text-white hover:bg-white/5',
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </aside>

      <main className="flex-1 ml-60 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold gradient-text">
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
        </div>

        {tab === 'config' && <ConfigForm />}
        {tab === 'sessions' && <SessionTable />}
        {tab === 'manual' && <ManualShare />}
      </main>
    </div>
  );
}
