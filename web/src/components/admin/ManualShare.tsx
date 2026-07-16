import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { api } from '../../lib/api';
import { copyToClipboard } from '../../lib/utils';
import type { SessionInfo } from '../../types';

export function ManualShare() {
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SessionInfo | null>(null);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!userId || !username) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const session = await api.createManualShare({
        sharerUserId: userId,
        sharerUsername: username,
      });
      setResult(session);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-semibold text-white mb-1">手动开放分享</h3>
      <p className="text-xs text-muted mb-4">
        为指定 KOOK 用户生成共享链接，无需经过机器人指令
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted mb-1 block">KOOK 用户 ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="如 1234567890"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-dim focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">用户名称</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="显示名称"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-dim focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading || !userId || !username}
        className="btn-brand px-5 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        生成共享链接
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-300 bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 bg-green-500/10 border border-green-400/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-300 text-sm mb-2">
            <CheckCircle2 className="w-4 h-4" />
            共享链接已生成
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white bg-black/30 px-3 py-2 rounded-lg truncate">
              {result.shareLink}
            </code>
            <button
              onClick={() => copyToClipboard(result.shareLink)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
