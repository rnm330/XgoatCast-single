import { ConfigService } from '../config/config.service';

/** 共享开始时推送给频道的观看卡片 */
export function buildShareCard(opts: {
  sharerUsername: string;
  viewUrl: string;
  coverUrl: string;
}): unknown {
  return [
    {
      type: 'card',
      theme: 'secondary',
      size: 'lg',
      modules: [
        {
          type: 'container',
          elements: [
            { type: 'image', src: opts.coverUrl, size: 'lg' },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '**屏幕共享已开始** 🐑\n' + (opts.sharerUsername || '匿名用户') + ' 正在共享屏幕',
          },
        },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '点击下方按钮即可免登录观看，无需安装任何软件',
          },
        },
        { type: 'divider' },
        {
          type: 'action-group',
          elements: [
            {
              type: 'button',
              text: { type: 'plain-text', content: '▶ 点击观看' },
              theme: 'primary',
              click: 'link',
              value: opts.viewUrl,
            },
          ],
        },
      ],
    },
  ];
}

/** 发起共享时回复给用户的共享链接卡片（同时带「开始共享」与「点击观看」按钮） */
export function buildShareLinkCard(opts: {
  sharerUsername: string;
  shareUrl: string;
  viewUrl?: string;
}): unknown {
  const buttons: unknown[] = [
    {
      type: 'button',
      text: { type: 'plain-text', content: '🖥 开始共享' },
      theme: 'success',
      click: 'link',
      value: opts.shareUrl,
    },
  ];
  // 即便共享还没开始，「点击观看」也能在共享开启后直接观看
  if (opts.viewUrl) {
    buttons.push({
      type: 'button',
      text: { type: 'plain-text', content: '▶ 点击观看' },
      theme: 'primary',
      click: 'link',
      value: opts.viewUrl,
    });
  }
  return [
    {
      type: 'card',
      theme: 'primary',
      size: 'lg',
      modules: [
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '**Xgoat.Cast 小羊屏幕共享已创建** 🐑\n' + (opts.sharerUsername || '用户') + '，点击下方按钮开始共享你的屏幕。',
          },
        },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '💡 **使用说明**\n• 点击「开始共享」后在浏览器中授权屏幕采集，记得打开声音权限\n• 频道成员可随时点击「点击观看」免登录观看\n• 关闭网页后链接会在短时间内自动失效\n• 无人观看时，一定要及时停止共享，节省服务器费用！',
          },
        },
        { type: 'divider' },
        {
          type: 'action-group',
          elements: buttons,
        },
      ],
    },
  ];
}

/** 共享结束后发送的小卡片，带统计信息和「重新发起共享」回调按钮 */
export function buildEndedCard(opts: {
  totalViewerJoins: number;
  durationMs: number | null;
  billingMinutes: number;
}): unknown {
  const totalSeconds = opts.durationMs ? Math.max(0, Math.round(opts.durationMs / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const durationText = hours > 0
    ? `${hours}小时${minutes}分${seconds}秒`
    : `${minutes}分${seconds}秒`;
  const cost = (opts.billingMinutes * 0.007).toFixed(2);

  return [
    {
      type: 'card',
      theme: 'secondary',
      size: 'lg',
      modules: [
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '**Xgoat.Cast 屏幕共享已结束** 🐑',
          },
        },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content:
              `📊 **统计信息**\n` +
              `• 观看总人数：${opts.totalViewerJoins} 人\n` +
              `• 屏幕共享总时长：${durationText}\n` +
              `• 消耗直播服务器费用：¥${cost}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '共享链接已失效，如需重新共享请点击下方按钮',
          },
        },
        {
          type: 'action-group',
          elements: [
            {
              type: 'button',
              text: { type: 'plain-text', content: '🔄 重新发起共享' },
              theme: 'primary',
              click: 'return-val',
              value: 'reshare',
            },
          ],
        },
      ],
    },
  ];
}

/** 帮助指令卡片 */
export function buildHelpCard(): unknown {
  return [
    {
      type: 'card',
      theme: 'secondary',
      size: 'lg',
      modules: [
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '**小羊屏幕共享 · 使用说明** 🐑',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '**可用指令：**\n• 发送 `屏幕共享` — 发起屏幕共享（无需斜杠）\n• 发送 `帮助` — 查看使用说明',
          },
        },
        {
          type: 'section',
          text: {
            type: 'kmarkdown',
            content: '**使用流程：**\n1. 在频道发送 `屏幕共享`\n2. 点击机器人回复的「开始共享」按钮\n3. 在浏览器中授权屏幕采集\n4. 频道自动收到观看卡片\n5. 频道成员点击卡片即可免登录观看',
          },
        },
      ],
    },
  ];
}

export function getCoverUrl(config: ConfigService): string {
  return config.get().server.publicDomain + '/cover-default.png';
}
