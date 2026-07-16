import { useEffect, useState } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { QUALITY_OPTIONS } from '../../hooks/useScreenShare';
import type { AdminConfig } from '../../types';

export function ConfigForm() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminConfig().then(setConfig).catch((e) => setError(e.message));
  }, []);

  const update = (path: string[], value: unknown) => {
    setConfig((c) => {
      if (!c) return c;
      const next = JSON.parse(JSON.stringify(c));
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    try {
      await api.updateAdminConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!config) return <div className="text-muted text-sm">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <ConfigSection title="声网 Agora" desc="在声网控制台获取 App ID 与 App Certificate">
          <Field
            label="App ID"
            value={config.agora.appId}
            onChange={(v) => update(['agora', 'appId'], v)}
            placeholder="如 8a3c..."
            description="声网控制台的应用 ID，用于标识您的应用"
          />
          <Field
            label="App Certificate"
            value={config.agora.appCertificate}
            onChange={(v) => update(['agora', 'appCertificate'], v)}
            placeholder="已配置则显示 ******"
            description="声网控制台的应用证书，用于生成 Token"
          />
          <Field
            label="Token 有效期（秒）"
            type="number"
            value={String(config.agora.tokenExpireSec)}
            onChange={(v) => update(['agora', 'tokenExpireSec'], Number(v))}
            description="生成的声网 Token 有效时间，过期后需要重新获取"
          />
          <div>
            <label className="text-xs text-muted mb-2 block">允许的画质（勾选后共享页只显示已启用的选项）</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUALITY_OPTIONS.map((q) => {
                const checked = config.agora.allowedQualities.includes(q.key);
                return (
                  <label
                    key={q.key}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm',
                      checked
                        ? 'border-brand/40 bg-brand/10 text-white'
                        : 'border-white/8 bg-white/[0.03] text-muted hover:border-white/15',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...config.agora.allowedQualities, q.key]
                          : config.agora.allowedQualities.filter((k) => k !== q.key);
                        update(['agora', 'allowedQualities'], next.length > 0 ? next : [q.key]);
                      }}
                      className="accent-brand"
                    />
                    {q.label}
                    <span className="text-dim text-xs ml-auto">
                      {q.encoderConfig.width}×{q.encoderConfig.height}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </ConfigSection>

        <ConfigSection title="KOOK 机器人" desc="配置机器人 Token 与触发词">
          <Field
            label="Bot Token"
            value={config.kook.botToken}
            onChange={(v) => update(['kook', 'botToken'], v)}
            placeholder="已配置则显示 ******"
            description="KOOK 机器人的 Token，用于发送消息和接收事件"
          />
          <Field
            label="触发词（逗号分隔，消息包含任意词即触发共享）"
            value={config.kook.triggerWords}
            onChange={(v) => update(['kook', 'triggerWords'], v)}
            placeholder="屏幕共享,共享屏幕"
            description="用户在频道发送包含这些关键词的消息时，自动触发屏幕共享"
          />
        </ConfigSection>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ConfigSection title="会话保活" desc="控制声网计费的关键参数">
          <div className="grid grid-cols-1 gap-3">
            <Field
              label="重连宽限期（秒）"
              type="number"
              value={String(config.session.gracePeriodSec)}
              onChange={(v) => update(['session', 'gracePeriodSec'], Number(v))}
              description="心跳丢失后，等待用户重新连接的时间。超时后共享自动结束"
            />
            <Field
              label="无发布者超时（秒）"
              type="number"
              value={String(config.session.noPublisherTimeoutSec)}
              onChange={(v) =>
                update(['session', 'noPublisherTimeoutSec'], Number(v))
              }
              description="没有发布者（共享者）连接的时间阈值，超时后共享自动结束"
            />
            <Field
              label="心跳间隔（秒）"
              type="number"
              value={String(config.session.heartbeatIntervalSec)}
              onChange={(v) =>
                update(['session', 'heartbeatIntervalSec'], Number(v))
              }
              description="客户端向服务器发送心跳的间隔，用于检测连接状态"
            />
            <Field
              label="停止后恢复宽限（秒）"
              type="number"
              value={String(config.session.shareStopGraceSec)}
              onChange={(v) =>
                update(['session', 'shareStopGraceSec'], Number(v))
              }
              description="用户主动停止共享后，原链接仍可恢复共享的时间窗口"
            />
            <Field
              label="无人观看超时（秒）"
              type="number"
              value={String(config.session.noViewerTimeoutSec)}
              onChange={(v) =>
                update(['session', 'noViewerTimeoutSec'], Number(v))
              }
              description="没有观众观看的时间阈值，超时后共享自动结束，节省服务器费用"
            />
          </div>
        </ConfigSection>

        <ConfigSection title="服务域名" desc="用于生成长链接的外部可访问地址">
          <Field
            label="Public Domain"
            value={config.server.publicDomain}
            onChange={(v) => update(['server', 'publicDomain'], v)}
            placeholder="https://your-domain.com"
            description="服务器对外访问地址，用于生成共享链接和观看链接"
          />
        </ConfigSection>
      </div>

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-brand px-6 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 disabled:opacity-40"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saved ? '已保存' : '保存配置'}
      </button>
    </div>
  );
}

function ConfigSection({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="text-xs text-muted mb-4 mt-0.5">{desc}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  description?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted mb-1 block">{label}</label>
      {description && (
        <p className="text-[11px] text-dim mb-1.5 leading-relaxed">{description}</p>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-dim focus:outline-none focus:border-brand/50 transition-colors"
      />
    </div>
  );
}
