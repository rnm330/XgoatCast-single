import { Monitor, Volume2, Mic, Video } from 'lucide-react';
import { cn } from '../lib/utils';

interface PermItem {
  icon: typeof Monitor;
  title: string;
  desc: string;
  required: boolean;
  defaultOn: boolean;
}

const items: PermItem[] = [
  {
    icon: Monitor,
    title: '屏幕采集',
    desc: '浏览器会弹窗让你选择共享整个屏幕或某个窗口',
    required: true,
    defaultOn: true,
  },
  {
    icon: Volume2,
    title: '系统声音',
    desc: '勾选「分享音频」即可共享电脑播放的声音（Chrome 支持）',
    required: true,
    defaultOn: true,
  },
  {
    icon: Mic,
    title: '麦克风',
    desc: '默认关闭，需要语音解说时再开启',
    required: false,
    defaultOn: false,
  },
  {
    icon: Video,
    title: '摄像头',
    desc: '默认关闭，需要露脸时再开启',
    required: false,
    defaultOn: false,
  },
];

export function PermissionGuide() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={i}
            className="glass rounded-2xl p-5 animate-slide-up hover:border-brand/40 transition-colors"
            style={{ animationDelay: i * 80 + 'ms' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-dark to-brand flex items-center justify-center shadow-lg shadow-brand/20">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  item.defaultOn
                    ? 'bg-brand/15 text-brand-light'
                    : 'bg-white/5 text-muted',
                )}
              >
                {item.defaultOn ? '默认开启' : '默认关闭'}
              </span>
            </div>
            <h4 className="font-semibold text-white mb-1">{item.title}</h4>
            <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
