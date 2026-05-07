import { ProductCard } from '@/components/product-card';
import type { Produto, UserAlert } from '@/lib/types';

function matchesAlert(product: Produto, alert: UserAlert): boolean {
  const hasKeyword   = !!alert.keyword;
  const hasCategoria = !!alert.categoria;
  if (!hasKeyword && !hasCategoria) return false;

  const searchText     = `${product.nome} ${product.nome_traduzido ?? ''}`.toLowerCase();
  const keywordMatch   = hasKeyword   && searchText.includes(alert.keyword.toLowerCase());
  const categoriaMatch = hasCategoria && product.categoria === alert.categoria;

  let matches: boolean;
  if (hasKeyword && hasCategoria) {
    matches = keywordMatch && categoriaMatch;
  } else if (hasKeyword) {
    matches = keywordMatch;
  } else {
    matches = categoriaMatch;
  }

  if (!matches) return false;
  if (alert.size) return (product.sizes ?? []).includes(alert.size);
  return true;
}

export function matchProductsToAlerts(products: Produto[], alerts: UserAlert[]): Produto[] {
  const active = alerts.filter((a) => a.is_active);
  if (!active.length) return [];
  return products.filter((p) => active.some((a) => matchesAlert(p, a)));
}

interface AlertMatchesProps {
  matches: Produto[];
}

export function AlertMatches({ matches }: AlertMatchesProps) {
  if (!matches.length) {
    return (
      <div className="rounded-xl border py-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-2xl mb-3">🔍</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
          Nenhum produto encontrado para os seus alertas no momento.
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
          Quando novos produtos chegarem, eles aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {matches.map((p, i) => (
        <ProductCard key={p.id} produto={p} index={i} />
      ))}
    </div>
  );
}
