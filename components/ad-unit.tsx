'use client';

import { useEffect, useRef } from 'react';

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
}

const AD_CLIENT = 'ca-pub-5158893095104645';

/**
 * Google AdSense ad unit.
 * The AdSense script is loaded once in app/layout.tsx.
 * Each instance renders an <ins> tag and pushes to adsbygoogle.
 */
export function AdUnit({ slot, format = 'auto', className, style }: AdUnitProps) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      // @ts-expect-error adsbygoogle is injected by the AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {}
  }, []);

  return (
    <div className={className} style={style}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
