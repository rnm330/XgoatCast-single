import { useState, useEffect } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { api, setAdminToken } from '../../lib/api';

interface Props {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockUntil, setLockUntil] = useState(0); // 锁定到期的时间戳
  const [now, setNow] = useState(Date.now());

  // 锁定倒计时驱动
  useEffect(() => {
    if (lockUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil, now]);

  const remainingLock = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  const isLocked = remainingLock > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.adminLogin(password);
      if (res.ok && res.token) {
        setAdminToken(res.token);
        onSuccess();
      } else {
        if (res.locked && res.retryAfter) {
          setLockUntil(Date.now() + res.retryAfter * 1000);
          setNow(Date.now());
        }
        setError(res.message || '登录失败');
      }
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl p-8 w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-dark to-brand flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-brand/30">
            🐑
          </div>
          <h1 className="text-xl font-bold">Xgoat.Cast</h1>
          <p className="text-sm text-muted mt-1">管理后台登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1.5 block">管理员密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                disabled={isLocked}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-dim focus:outline-none focus:border-brand/50 focus:bg-white/[0.07] transition-colors disabled:opacity-50"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {isLocked ? `${error}（剩余 ${remainingLock}s）` : error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || isLocked}
            className="btn-brand w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLocked ? `请等待 ${remainingLock}s` : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
