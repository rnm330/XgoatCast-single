import { Mic, MicOff, Video, VideoOff, Radio, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ShareSettings } from '../types';

interface Props {
  settings: ShareSettings;
  onToggle: (key: keyof ShareSettings) => void;
  isSharing: boolean;
  viewerCount: number;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function ShareControls({
  settings,
  onToggle,
  isSharing,
  viewerCount,
  onStart,
  onStop,
  disabled,
}: Props) {
  return (
    <div className="glass-strong rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">共享设置</h3>
        {isSharing && (
          <span className="flex items-center gap-1.5 text-sm text-brand-light">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            正在共享 · {viewerCount} 人观看
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ToggleCard
          icon={settings.enableMic ? Mic : MicOff}
          label="麦克风"
          active={settings.enableMic}
          onClick={() => onToggle('enableMic')}
        />
        <ToggleCard
          icon={settings.enableCamera ? Video : VideoOff}
          label="摄像头"
          active={settings.enableCamera}
          onClick={() => onToggle('enableCamera')}
        />
      </div>

      {!isSharing ? (
        <button
          onClick={onStart}
          disabled={disabled}
          className={cn(
            'btn-brand w-full py-4 rounded-xl text-white font-semibold text-base',
            'flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Radio className="w-5 h-5" />
          开始共享
        </button>
      ) : (
        <button
          onClick={onStop}
          className="w-full py-4 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors"
        >
          <Square className="w-5 h-5" />
          停止共享
        </button>
      )}

      <p className="text-xs text-dim text-center">
        点击「开始共享」后浏览器会弹出权限请求，请选择要共享的屏幕或窗口
      </p>
    </div>
  );
}

function ToggleCard({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-all',
        active
          ? 'border-brand/50 bg-brand/10 text-white'
          : 'border-white/8 bg-white/[0.03] text-muted hover:border-white/15',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center',
          active ? 'bg-brand/20 text-brand-light' : 'bg-white/5',
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <span className="font-medium text-sm">{label}</span>
      <span
        className={cn(
          'ml-auto text-xs px-2 py-0.5 rounded-full',
          active ? 'bg-brand/20 text-brand-light' : 'bg-white/5 text-dim',
        )}
      >
        {active ? '开' : '关'}
      </span>
    </button>
  );
}
