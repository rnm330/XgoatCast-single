import { Github, Monitor, Users, Zap, Shield, Settings, Mail, ExternalLink } from 'lucide-react';

const GITHUB_URL = 'https://github.com/rnm330/XgoatCast';
const DEVELOPER = 'xgoat小羊';
const EMAIL = 'xgoateam@gmail.com';

const FEATURES = [
  {
    icon: Zap,
    title: '关键词秒触发',
    desc: '在 KOOK 频道发送「屏幕共享」即可发起，机器人自动推送卡片，无需斜杠指令。',
  },
  {
    icon: Users,
    title: '免登录观看',
    desc: '频道成员点击卡片即可观看，分步权限引导，点击「开始共享」才加入声网频道。',
  },
  {
    icon: Monitor,
    title: '多画质支持',
    desc: '540p30 ~ 4K30 多种画质可选，懒加入频道，按需计费，省钱省流量。',
  },
  {
    icon: Shield,
    title: '会话保活',
    desc: '心跳看门狗 + 30 秒重连宽限 + 60 秒无发布者自动结束，链接失效即不可用。',
  },
  {
    icon: Settings,
    title: '可视化管理后台',
    desc: '在线配置声网凭证、KOOK Token、触发词与保活参数，手动开放与强制结束。',
  },
  {
    icon: Shield,
    title: '登录防暴破',
    desc: '管理后台登录按 IP 限流，连续失败自动锁定，保障账户安全。',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-dark">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 glass-strong px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-dark to-brand flex items-center justify-center text-xl shadow-lg shadow-brand/30">
            🐑
          </div>
          <div>
            <p className="font-bold text-base leading-tight">Xgoat.Cast</p>
            <p className="text-xs text-dim">小羊屏幕共享</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-xs text-brand-light mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          基于 Agora 声网 + KOOK 开放平台
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text mb-4">
          Xgoat.Cast · 小羊屏幕共享
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-2xl mb-8 leading-relaxed">
          在 KOOK 频道发送关键词即可快速发起屏幕共享，机器人自动推送精美卡片与观看链接，
          频道成员点击免登录观看。懒加入、按需计费、省心省钱。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brand px-6 py-3 rounded-xl text-white font-medium text-sm flex items-center gap-2"
          >
            <Github className="w-4 h-4" />
            查看源码
          </a>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="px-6 pb-20 max-w-5xl w-full mx-auto">
        <h2 className="text-center text-2xl font-bold mb-10">功能特性</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="glass rounded-2xl p-5 hover:border-brand/30 border border-transparent transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-brand-light" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 底部 */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand flex items-center justify-center text-base">
              🐑
            </div>
            <div>
              <p className="text-sm font-medium">Xgoat.Cast</p>
              <p className="text-xs text-dim">
                © {new Date().getFullYear()} Xgoat.Cast · 由 {DEVELOPER} 开发
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {EMAIL}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
