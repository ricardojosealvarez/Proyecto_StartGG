import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('mantiene la búsqueda visible antes de seleccionar un jugador', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Buscar jugador');
    expect(markup).toContain('Selecciona un jugador para abrir su perfil.');
  });
});
