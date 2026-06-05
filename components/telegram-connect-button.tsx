'use client';

interface Props {
  connected:    boolean;
  username?:    string | null;
  referralCode: string;
  botUsername:  string;
}

export function TelegramConnectButton({ connected, username, referralCode, botUsername }: Props) {
  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--telegram-color)" aria-hidden>
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.993.889z"/>
        </svg>
        <div>
          <p className="text-sm font-medium text-green-500">✓ Vinculado</p>
          {username && <p className="text-xs" style={{ color: 'var(--text-3)' }}>@{username}</p>}
        </div>
      </div>
    );
  }

  const link = `https://t.me/${botUsername}?start=${referralCode}`;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: 'var(--telegram-color)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.993.889z"/>
      </svg>
      Vincular Telegram
    </a>
  );
}
