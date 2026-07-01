export function formatEventDate(timestamp?: number | null) {
  if (!timestamp) return 'Fecha no disponible';

  return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
