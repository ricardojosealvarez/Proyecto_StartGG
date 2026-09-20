import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getPlayerAnalytics } from '../lib/api';
import type { PlayerSummary, PlayerYearStats } from '../lib/types';
import type { TournamentMode } from '../lib/tournamentMode';
import { SectionTitle, Surface } from './DesignSystem';

interface PlayerAnalyticsProps {
  player: PlayerSummary;
  videogameId: number;
  tournamentMode: TournamentMode;
  onBack: () => void;
}

function BarChart({ data }: { data: PlayerYearStats[] }) {
  const maxValue = Math.max(1, ...data.flatMap((entry) => [entry.tournaments, entry.wins]));
  return (
    <div className="analytics-bars" role="img" aria-label="Torneos y victorias por año">
      {data.map((entry) => (
        <div key={entry.year} className="analytics-bars__group">
          <div className="analytics-bars__columns">
            {(['tournaments', 'wins'] as const).map((key) => (
              <div
                key={key}
                className={`analytics-bars__bar analytics-bars__bar--${key}`}
                style={{ height: `${Math.max(4, (entry[key] / maxValue) * 100)}%` }}
                title={`${key === 'tournaments' ? 'Torneos' : 'Victorias'}: ${entry[key]}`}
              >
                <span>{entry[key]}</span>
              </div>
            ))}
          </div>
          <strong>{entry.year}</strong>
        </div>
      ))}
    </div>
  );
}

function ScoreChart({ data }: { data: PlayerYearStats[] }) {
  const scoredData = data.filter(
    (entry) => entry.averageScore !== null && entry.bestScore !== null
  );
  const values = scoredData.flatMap((entry) => [entry.averageScore!, entry.bestScore!]);
  const min = values.length ? Math.min(...values) : 0;
  const range = Math.max(1, (values.length ? Math.max(...values) : 1) - min);
  const points = (key: 'averageScore' | 'bestScore') =>
    scoredData
      .map((entry, index) => {
        const x = scoredData.length === 1 ? 50 : (index / (scoredData.length - 1)) * 100;
        return `${x},${92 - (((entry[key] ?? min) - min) / range) * 78}`;
      })
      .join(' ');

  if (!scoredData.length)
    return <div className="ui-empty-state">No hay puntuaciones Glicko-2 almacenadas.</div>;

  return (
    <div className="analytics-score" role="img" aria-label="Score medio y mejor score por año">
      <svg viewBox="0 0 100 110" preserveAspectRatio="none">
        <polyline
          className="analytics-score__line analytics-score__line--average"
          points={points('averageScore')}
        />
        <polyline
          className="analytics-score__line analytics-score__line--best"
          points={points('bestScore')}
        />
      </svg>
      <div className="analytics-score__labels">
        {scoredData.map((entry) => (
          <div key={entry.year}>
            <strong>{entry.year}</strong>
            <span>Medio {Math.round(entry.averageScore!)}</span>
            <span>Mejor {Math.round(entry.bestScore!)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerAnalytics({
  player,
  videogameId,
  tournamentMode,
  onBack,
}: PlayerAnalyticsProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['playerAnalytics', player.id, videogameId, tournamentMode],
    queryFn: () => getPlayerAnalytics(player.id, videogameId, tournamentMode),
  });
  return (
    <div className="analytics-page">
      <button type="button" className="ui-action-button" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Volver al perfil
      </button>
      <Surface>
        <SectionTitle
          eyebrow={`${player.gamerTag} · ${tournamentMode === 'all' ? 'Todos' : tournamentMode === 'online' ? 'Online' : 'Offline'}`}
          title="Estadísticas del jugador"
        />
        {isLoading && <div>Cargando estadísticas...</div>}
        {error && <div className="ui-empty-state">No se pudieron cargar las estadísticas.</div>}
        {data?.years.length === 0 && (
          <div className="ui-empty-state">No hay historial local para este jugador y juego.</div>
        )}
        {data?.years.length ? (
          <div className="analytics-grid">
            <section className="analytics-card">
              <h3>Torneos y Victorias por Año</h3>
              <div className="analytics-legend">
                <span className="is-tournaments" />
                Torneos <span className="is-wins" />
                Victorias en sets
              </div>
              <BarChart data={data.years} />
            </section>
            <section className="analytics-card">
              <h3>Score medio y mejor Score por año</h3>
              <div className="analytics-legend">
                <span className="is-average" />
                Score medio <span className="is-best" />
                Mejor score
              </div>
              <ScoreChart data={data.years} />
            </section>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
