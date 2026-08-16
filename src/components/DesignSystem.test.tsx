import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerAvatar, SectionTitle, Surface } from './DesignSystem';

describe('DesignSystem', () => {
  it('renders reusable surfaces and section hierarchy', () => {
    const markup = renderToStaticMarkup(
      <Surface>
        <SectionTitle eyebrow="Perfil" title="Jugador" description="Datos reales" />
      </Surface>
    );

    expect(markup).toContain('ui-surface');
    expect(markup).toContain('Perfil');
    expect(markup).toContain('Datos reales');
  });

  it('uses player initials when no image is available', () => {
    const markup = renderToStaticMarkup(<PlayerAvatar gamerTag="MkLeo" />);
    expect(markup).toContain('MK');
    expect(markup).toContain('aria-label="MkLeo"');
  });
});
