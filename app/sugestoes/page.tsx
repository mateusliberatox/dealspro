import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { VoteButton } from '@/components/vote-button';
import { createClient } from '@/lib/supabase/server';
import {
  getFeatureRequests, CATEGORY_LABELS, STATUS_LABELS,
  type FeatureRequest, type FeatureStatus,
} from '@/lib/feature-requests';

export const dynamic = 'force-dynamic';

const DISCORD_INVITE = 'https://discord.gg/dBXRdqM2Z';

const STATUS_ORDER: FeatureStatus[] = ['em_desenvolvimento', 'planejado', 'concluido'];

export const metadata: Metadata = {
  title: 'Sugestões & Roadmap · Próximas novidades',
  description: 'Veja o que está em desenvolvimento, o que está planejado e o que já foi entregue no DealsPro — e vote nas próximas novidades.',
};

export default async function SugestoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const features = await getFeatureRequests(user?.id);

  const byStatus = new Map<FeatureStatus, FeatureRequest[]>();
  for (const f of features) {
    const list = byStatus.get(f.status) ?? [];
    list.push(f);
    byStatus.set(f.status, list);
  }
  // dentro de cada status, prioriza quem tem mais votos
  for (const list of byStatus.values()) list.sort((a, b) => b.votes - a.votes);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">

        <div className="space-y-2 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Sugestões &amp; Roadmap
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: 'var(--text-3)' }}>
            Acompanhe o que estamos construindo no DealsPro e vote nas funcionalidades que você
            mais quer ver. As mais votadas sobem de prioridade no nosso roadmap.
          </p>
          {!user && (
            <p className="text-xs" style={{ color: 'var(--text-4)' }}>
              <a href="/login" className="underline" style={{ color: 'var(--accent-text)' }}>Entre na sua conta</a> para votar.
            </p>
          )}
        </div>

        {STATUS_ORDER.map((status) => {
          const items = byStatus.get(status);
          if (!items?.length) return null;

          return (
            <div key={status} className="space-y-3 animate-fade-in-up">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>
                {STATUS_LABELS[status]}
              </h2>

              <div className="space-y-3">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border p-4 flex items-start gap-3"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <VoteButton
                      featureId={f.id}
                      initialVotes={f.votes}
                      initialVoted={f.votedByUser}
                      loggedIn={!!user}
                    />

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{f.title}</p>
                        {f.isPro && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                          >
                            ★ PREMIUM
                          </span>
                        )}
                      </div>
                      {f.description && (
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{f.description}</p>
                      )}
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[10px]"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-4)' }}
                      >
                        {CATEGORY_LABELS[f.category] ?? f.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div
          className="rounded-xl border p-5 space-y-3 animate-fade-in-up"
          style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-strong)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--accent-text)' }}>
            Tem uma ideia que não está na lista?
          </p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            Conta pra gente no Discord — sugestões da comunidade ajudam a definir as próximas
            novidades do DealsPro.
          </p>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--discord-color)' }}
          >
            Entrar no Discord →
          </a>
        </div>
      </main>
    </div>
  );
}
