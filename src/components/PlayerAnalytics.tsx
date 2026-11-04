import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getPlayerAnalytics } from '../lib/api';
import { getPlayerCharacterStats } from '../lib/api';
import type { PlayerSummary, PlayerYearStats } from '../lib/types';
import type { TournamentMode } from '../lib/tournamentMode';
import { SectionTitle, Surface } from './DesignSystem';
import { SummaryCard } from './SummaryCard';

interface PlayerAnalyticsProps {
  player: PlayerSummary;
  videogameId: number;
  tournamentMode: TournamentMode;
  onTournamentModeChange: (mode: TournamentMode) => void;
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

function RatioChart({ data }: { data: PlayerYearStats[] }) {
  return (
    <div className="analytics-bars analytics-bars--single" role="img" aria-label="Ratio de victorias por año">
      {data.map((entry) => {
        const ratio = entry.setsPlayed ? (entry.wins / entry.setsPlayed) * 100 : 0;
        return (
          <div key={entry.year} className="analytics-bars__group">
            <div className="analytics-bars__columns">
              <div className="analytics-bars__bar analytics-bars__bar--wins" style={{ height: `${Math.max(4, ratio)}%` }} title={`${ratio.toFixed(1)} %`}>
                <span>{Math.round(ratio)}%</span>
              </div>
            </div>
            <strong>{entry.year}</strong>
          </div>
        );
      })}
    </div>
  );
}

function CharacterChart({ videogameId, playerId, tournamentMode }: { videogameId: number; playerId: string; tournamentMode: TournamentMode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['playerCharacterStats', playerId, videogameId],
    queryFn: () => getPlayerCharacterStats(playerId, videogameId),
    enabled: tournamentMode === 'all',
    staleTime: 60_000,
  });
  if (tournamentMode !== 'all') {
    return <div className="ui-empty-state">El desglose de personajes aún no está separado por modalidad.</div>;
  }
  if (isLoading) return <div>Cargando personajes...</div>;
  if (!data?.characterUsage.length) return <div className="ui-empty-state">No hay datos de personajes.</div>;
  const topCharacters = data.characterUsage.slice(0, 8);
  const maxGames = Math.max(1, ...topCharacters.map((character) => character.games));
  return (
    <div className="analytics-character-chart" role="img" aria-label="Personajes más utilizados">
      {topCharacters.map((character) => (
        <div key={character.characterId} className="analytics-character-row">
          <span>{character.name}</span>
          <div><i style={{ width: `${(character.games / maxGames) * 100}%` }} /><strong>{character.games}</strong></div>
        </div>
      ))}
    </div>
  );
}

export function PlayerAnalytics({
  player,
  videogameId,
  tournamentMode,
  onTournamentModeChange,
  onBack,
}: PlayerAnalyticsProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['playerAnalytics', player.id, videogameId, tournamentMode],
    queryFn: () => getPlayerAnalytics(player.id, videogameId, tournamentMode),
    staleTime: 60_000,
  });
  const { data: modeData } = useQuery({
    queryKey: ['playerAnalyticsModes', player.id, videogameId],
    queryFn: async () => {
      const [online, offline] = await Promise.all([
        getPlayerAnalytics(player.id, videogameId, 'online'),
        getPlayerAnalytics(player.id, videogameId, 'offline'),
      ]);
      return { online, offline };
    },
    enabled: tournamentMode === 'all',
    staleTime: 60_000,
  });
  return (
    <div className="analytics-page">
      <button type="button" className="ui-action-button" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Volver al perfil
      </button>
      <Surface>
        <div className="ui-results-toolbar analytics-toolbar">
          <strong>Modalidad</strong>
          <div className="ui-filter-group" aria-label="Filtrar estadísticas por modalidad">
            {(
              [
                ['all', 'Todos'],
                ['offline', 'Offline'],
                ['online', 'Online'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`ui-chip ui-chip--button${tournamentMode === mode ? ' is-active' : ''}`}
                aria-pressed={tournamentMode === mode}
                onClick={() => onTournamentModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
          <>
          <div className="ui-card-grid analytics-summary">
            <SummaryCard label="Torneos jugados" value={data.summary.tournaments} />
            <SummaryCard label="Victorias en sets" value={data.summary.setWins} tone="success" />
            <SummaryCard label="Top 8" value="N/D" tone="neutral" />
          </div>
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
              <h3>Ratio de victorias por año</h3>
              <div className="analytics-legend">Victorias / sets jugados</div>
              <RatioChart data={data.years} />
            </section>
            <section className="analytics-card">
              <h3>Sets jugados por año</h3>
              <div className="analytics-legend">Total de sets registrados</div>
              <BarChart data={data.years.map((entry) => ({ ...entry, wins: entry.setsPlayed }))} />
            </section>
            {modeData && (
              <section className="analytics-card">
                <h3>Comparativa online / offline</h3>
                <div className="analytics-mode-comparison">
                  <div><strong>Online</strong><span>{modeData.online.summary.tournaments} torneos · {modeData.online.summary.setWins} victorias</span></div>
                  <div><strong>Offline</strong><span>{modeData.offline.summary.tournaments} torneos · {modeData.offline.summary.setWins} victorias</span></div>
                </div>
              </section>
            )}
            <section className="analytics-card">
              <h3>Personajes más utilizados</h3>
              <CharacterChart playerId={player.id} videogameId={videogameId} tournamentMode={tournamentMode} />
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
          </>
        ) : null}
      </Surface>
    </div>
  );
}
