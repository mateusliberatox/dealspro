'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos (TTL do QR code)
const POLL_MS    = 3_000;

type State = 'loading' | 'ready' | 'paid' | 'expired' | 'error';

export function PixQRDisplay() {
  const [state,     setState]     = useState<State>('loading');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [qrBase64,  setQrBase64]  = useState<string | null>(null);
  const [qrCode,    setQrCode]    = useState<string | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [timeLeft,  setTimeLeft]  = useState(TIMEOUT_MS);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current)  clearInterval(pollRef.current);
  }, []);

  const startTimer = useCallback((endAt: number) => {
    timerRef.current = setInterval(() => {
      const left = endAt - Date.now();
      if (left <= 0) { setState('expired'); stopAll(); }
      else setTimeLeft(left);
    }, 1_000);
  }, [stopAll]);

  const startPolling = useCallback((pid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const r    = await fetch(`/api/mercadopago/pix?id=${pid}`);
        const data = await r.json() as { status: string };
        if (data.status === 'approved') {
          stopAll();
          setState('paid');
          setTimeout(() => { window.location.href = '/upgrade/sucesso'; }, 2_000);
        }
      } catch { /* ignora falhas de rede */ }
    }, POLL_MS);
  }, [stopAll]);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/mercadopago/pix', { method: 'POST', signal: controller.signal })
      .then(r => r.json())
      .then((data: { error?: string; payment_id?: string; qr_code_base64?: string; qr_code?: string }) => {
        if (data.error) { setErrorMsg(data.error); setState('error'); return; }
        setPaymentId(data.payment_id ?? null);
        setQrBase64(data.qr_code_base64 ?? null);
        setQrCode(data.qr_code ?? null);
        setState('ready');
        const endAt = Date.now() + TIMEOUT_MS;
        startTimer(endAt);
        startPolling(data.payment_id!);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setErrorMsg(e instanceof Error ? e.message : 'Erro de rede');
        setState('error');
      });

    return () => { controller.abort(); stopAll(); };
  }, [startTimer, startPolling, stopAll]);

  async function handleCopy() {
    if (!qrCode) return;
    await navigator.clipboard.writeText(qrCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  function formatTime(ms: number) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (state === 'loading') {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="mx-auto w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text-3)' }}>Gerando QR code…</p>
      </div>
    );
  }

  if (state === 'paid') {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-4xl">✅</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>Pagamento confirmado!</p>
        <p style={{ color: 'var(--text-3)' }}>Redirecionando…</p>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-4xl">⏰</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>QR code expirado</p>
        <p style={{ color: 'var(--text-3)' }}>Gere um novo para continuar.</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-accent rounded-xl px-6 py-3 text-sm font-bold"
        >
          Gerar novo QR code
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-4xl">❌</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>Erro ao gerar QR code</p>
        {errorMsg && (
          <p className="text-xs font-mono px-4 py-2 rounded-lg text-left break-all" style={{ background: 'var(--surface-2)', color: '#f87171' }}>
            {errorMsg}
          </p>
        )}
        <p style={{ color: 'var(--text-3)' }}>Tente novamente ou use o pagamento por cartão.</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-accent rounded-xl px-6 py-3 text-sm font-bold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <span
          className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-3"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
        >
          PIX
        </span>
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
          Pague R$ 9,99 com PIX
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          30 dias de acesso Premium · QR code expira em{' '}
          <span className="font-mono font-bold" style={{ color: timeLeft < 60_000 ? '#f87171' : 'var(--text)' }}>
            {formatTime(timeLeft)}
          </span>
        </p>
      </div>

      {/* QR code */}
      <div className="glass rounded-2xl p-6 inline-block mx-auto">
        {qrBase64 ? (
          <img
            src={`data:image/png;base64,${qrBase64}`}
            alt="QR Code PIX"
            className="w-52 h-52 mx-auto rounded-lg"
          />
        ) : (
          <div className="w-52 h-52 mx-auto rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs" style={{ color: 'var(--text-4)' }}>QR code indisponível</p>
          </div>
        )}
      </div>

      {/* Copia e cola */}
      {qrCode && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Ou copie o código PIX
          </p>
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <p
              className="flex-1 text-xs font-mono truncate text-left"
              style={{ color: 'var(--text-2)' }}
            >
              {qrCode}
            </p>
            <button
              onClick={handleCopy}
              className="btn-accent rounded-lg px-3 py-1.5 text-xs font-bold shrink-0"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1 text-xs" style={{ color: 'var(--text-4)' }}>
        <p>Abra o app do seu banco → PIX → Pagar com QR code ou copia e cola.</p>
        <p>Confirmação automática em até 1 minuto após o pagamento.</p>
      </div>

      <a href="/upgrade" className="text-xs underline-offset-2 hover:underline" style={{ color: 'var(--text-4)' }}>
        ← Voltar para assinar com cartão
      </a>
    </div>
  );
}
