export interface ServiceTemplate {
  name: string;
  icon: string;
  website: string;
  group: string;
  aliases: string[];
}

export const serviceCatalog: ServiceTemplate[] = [
  {
    name: "Netflix",
    icon: "netflix",
    website: "https://www.netflix.com",
    group: "影音娱乐",
    aliases: ["奈飞", "网飞"],
  },
  {
    name: "Spotify",
    icon: "spotify",
    website: "https://www.spotify.com",
    group: "音乐",
    aliases: ["声田"],
  },
  {
    name: "Apple Music",
    icon: "apple-music",
    website: "https://music.apple.com",
    group: "音乐",
    aliases: ["苹果音乐"],
  },
  {
    name: "YouTube Premium",
    icon: "youtube",
    website: "https://www.youtube.com/premium",
    group: "影音娱乐",
    aliases: ["油管"],
  },
  {
    name: "YouTube Music",
    icon: "youtube-music",
    website: "https://music.youtube.com",
    group: "音乐",
    aliases: [],
  },
  {
    name: "Disney+",
    icon: "disney-plus",
    website: "https://www.disneyplus.com",
    group: "影音娱乐",
    aliases: ["迪士尼"],
  },
  {
    name: "HBO Max",
    icon: "hbo",
    website: "https://www.hbomax.com",
    group: "影音娱乐",
    aliases: ["Max"],
  },
  {
    name: "Amazon Prime",
    icon: "amazon-prime",
    website: "https://www.amazon.com/prime",
    group: "影音娱乐",
    aliases: ["亚马逊"],
  },
  {
    name: "哔哩哔哩大会员",
    icon: "bilibili",
    website: "https://www.bilibili.com",
    group: "影音娱乐",
    aliases: ["B站", "bilibili"],
  },
  {
    name: "ChatGPT",
    icon: "chatgpt",
    website: "https://chatgpt.com",
    group: "AI 工具",
    aliases: ["OpenAI", "GPT Plus", "GPT Pro"],
  },
  {
    name: "Claude",
    icon: "claude-ai",
    website: "https://claude.ai",
    group: "AI 工具",
    aliases: ["Anthropic"],
  },
  {
    name: "Google Gemini",
    icon: "google-gemini",
    website: "https://gemini.google.com",
    group: "AI 工具",
    aliases: ["谷歌", "Google AI"],
  },
  {
    name: "Perplexity",
    icon: "perplexity-dark",
    website: "https://www.perplexity.ai",
    group: "AI 工具",
    aliases: [],
  },
  {
    name: "GitHub Copilot",
    icon: "github-copilot",
    website: "https://github.com/features/copilot",
    group: "开发工具",
    aliases: [],
  },
  {
    name: "GitHub",
    icon: "github",
    website: "https://github.com",
    group: "开发工具",
    aliases: [],
  },
  {
    name: "Notion",
    icon: "notion",
    website: "https://www.notion.so",
    group: "效率办公",
    aliases: ["笔记"],
  },
  {
    name: "Microsoft 365",
    icon: "microsoft-365",
    website: "https://www.microsoft.com/microsoft-365",
    group: "效率办公",
    aliases: ["Office 365", "微软", "办公"],
  },
  {
    name: "Adobe Creative Cloud",
    icon: "adobe",
    website: "https://www.adobe.com/creativecloud.html",
    group: "设计工具",
    aliases: ["Photoshop", "PS", "Lightroom"],
  },
  {
    name: "Figma",
    icon: "figma",
    website: "https://www.figma.com",
    group: "设计工具",
    aliases: [],
  },
  {
    name: "iCloud+",
    icon: "icloud",
    website: "https://www.icloud.com",
    group: "云存储",
    aliases: ["苹果云", "iCloud"],
  },
  {
    name: "Google One",
    icon: "google-drive",
    website: "https://one.google.com",
    group: "云存储",
    aliases: ["谷歌云", "Google Drive"],
  },
  {
    name: "Dropbox",
    icon: "dropbox",
    website: "https://www.dropbox.com",
    group: "云存储",
    aliases: [],
  },
  {
    name: "OneDrive",
    icon: "microsoft-onedrive",
    website:
      "https://www.microsoft.com/microsoft-365/onedrive/online-cloud-storage",
    group: "云存储",
    aliases: ["微软云"],
  },
  {
    name: "1Password",
    icon: "1password",
    website: "https://1password.com",
    group: "安全工具",
    aliases: ["密码"],
  },
  {
    name: "Bitwarden",
    icon: "bitwarden",
    website: "https://bitwarden.com",
    group: "安全工具",
    aliases: ["密码"],
  },
  {
    name: "Proton Mail",
    icon: "proton-mail",
    website: "https://proton.me/mail",
    group: "安全工具",
    aliases: ["邮箱"],
  },
  {
    name: "NordVPN",
    icon: "nordvpn",
    website: "https://nordvpn.com",
    group: "网络工具",
    aliases: [],
  },
  {
    name: "Tailscale",
    icon: "tailscale",
    website: "https://tailscale.com",
    group: "网络工具",
    aliases: [],
  },
  {
    name: "Plex Pass",
    icon: "plex",
    website: "https://www.plex.tv",
    group: "影音娱乐",
    aliases: ["Plex"],
  },
  {
    name: "Emby Premiere",
    icon: "emby",
    website: "https://emby.media",
    group: "影音娱乐",
    aliases: ["Emby"],
  },
  {
    name: "Telegram Premium",
    icon: "telegram",
    website: "https://telegram.org",
    group: "社交通讯",
    aliases: ["电报"],
  },
  {
    name: "Discord Nitro",
    icon: "discord",
    website: "https://discord.com",
    group: "社交通讯",
    aliases: [],
  },
];

export const serviceIcon = (service: ServiceTemplate) =>
  `/service-icons/${service.icon}.webp`;

export function searchServices(query: string) {
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[\s+._-]/g, "");
  const term = normalize(query.trim());
  return serviceCatalog.filter((service) =>
    [service.name, service.website, service.group, ...service.aliases].some(
      (text) => normalize(text).includes(term),
    ),
  );
}
