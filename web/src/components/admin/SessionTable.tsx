import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, StopCircle, Users, Link2, Clock, BarChart3, Monitor, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { copyToClipboard, formatTime, cn } from '../../lib/utils';
import { QUALITY_OPTIONS } from '../../hooks/useScreenShare';
import type { SessionInfo } from '../../types';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: '待开始', color: 'bg-yellow-500/15 text-yellow-300' },
  active: { text: '共享中', color: 'bg-green-500/15 text-green-300' },
  grace: { text: '宽限期', color: 'bg-orange-500/15 text-orange-300' },
  ended: { text: '已结束', color: 'bg-white/5 text-dim' },
};

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  const msPart = ms % 1000;
  if (min > 0) {
    return `${min}分${s}秒${String(msPart).padStart(3, '0')}ms`;
  }
  return `${s}秒${String(msPart).padStart(3, '0')}ms`;
}

export function SessionTable() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const handleEnd = async (id: string) => {
    await api.endSession(id);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.deleteSessionRecord(id);
    load();
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <h3 className="font-semibold text-white">分享记录</h3>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-dim border-b border-white/5">
              <th className="px-5 py-3 font-medium">分享者</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">画质</th>
              <th className="px-5 py-3 font-medium">观看</th>
              <th className="px-5 py-3 font-medium">时长</th>
              <th className="px-5 py-3 font-medium">计费(分钟)</th>
              <th className="px-5 py-3 font-medium">开始时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-dim">
                  暂无分享记录
                </td>
              </tr>
            )}
            {sessions.map((s) => {
              const st = STATUS_LABEL[s.status] || STATUS_LABEL.ended;
              return (
                <tr
                  key={s.id}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-white">
                    {s.sharerUsername}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        st.color,
                      )}
                    >
                      {st.text}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5" />
                      {QUALITY_OPTIONS.find((q) => q.key === s.quality)?.label || s.quality}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1 text-muted">
                      <Users className="w-3.5 h-3.5" />
                      {s.peakViewers}
                      <span className="text-dim text-xs">/{s.totalViewerJoins}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(s.durationMs)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    <span className="flex items-center gap-1" title={s.billingDetail}>
                      <BarChart3 className="w-3.5 h-3.5" />
                      {s.billingMinutes > 0 ? `${s.billingMinutes}` : '-'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    {formatTime(s.startedAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(s.shareLink)}
                        title="复制分享链接"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                      {s.status !== 'ended' ? (
                        <button
                          onClick={() => handleEnd(s.id)}
                          title="强制结束"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(s.id)}
                          title="删除记录"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-dim hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
