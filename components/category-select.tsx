'use client';

import { useTransition } from 'react';
import { updateCategoriaAction } from '@/app/admin/actions';

const OPTIONS = ['Smartwatch', 'Bolsa / Mochila', 'Roupas', 'Eletrônicos', 'Calçados', 'Outros'];

export function CategorySelect({ id, current }: { id: number; current: string | null }) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(() => { updateCategoriaAction(id, next); });
  }

  return (
    <select
      defaultValue={current ?? 'Outros'}
      onChange={handleChange}
      disabled={pending}
      className="rounded border px-2 py-1 text-xs disabled:opacity-50 outline-none transition-colors"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)', color: 'var(--text-2)' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
    >
      {OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
