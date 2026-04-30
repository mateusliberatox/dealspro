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
      className="rounded border border-white/10 bg-[#1a1a1a] px-2 py-1 text-xs text-neutral-300 disabled:opacity-50 focus:border-orange-500 outline-none transition-colors"
    >
      {OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
