import { useQuery } from '@tanstack/react-query';
import { getPlayerStatsQuery, getStartggErrorMessage, requestStartgg } from '../lib/api';
import { formatEventDate } from '../lib/format';
import { PlayerCharacterStats, PlayerStatsResponse } from '../lib/types';
import { filterStandingsByMode, TournamentMode } from '../lib/tournamentMode';
import { SummaryCard } from './SummaryCard';
import { SectionTitle, Surface } from './DesignSystem';

interface PlayerStatsProps {
  playerId: string;
  videogameId: number;
  tournamentMode: TournamentMode;
  onTournamentModeChange: (mode: TournamentMode) => void;
  onOpenTournaments: () => void;
}

export function PlayerCharacterSummary({ stats }: { stats: PlayerCharacterStats }) {
  if (!stats.primaryCharacter) {
    return <div className="ui-empty-state">Personaje principal no disponible.</div>;
  }

  const featuredCharacters = [stats.primaryCharacter, ...stats.secondaryCharacters];

  return (
    <div className="ui-card-grid">
      {featuredCharacters.map((character, index) => (
        <SummaryCard
          key={character.characterId}
          label={
            index === 0
              ? stats.characterConfidence === 'low'
                ? 'Más utilizado · datos limitados'
                : 'Principal estimado'
              : 'Personaje complementario'
          }
          value={`${character.name} · ${Math.round(character.usage * 100)} %`}
          tone={index === 0 ? 'accent' : 'neutral'}
        />
      ))}
      <SummaryCard
        label="Datos y cobertura"
        value={`${stats.gamesWithCharacterData} · ${Math.round(stats.characterDataCoverage * 100)} %`}
      />
    </div>
  );
}

export function PlayerStats({
  playerId,
  videogameId,
  tournamentMode,
  onTournamentModeChange,
  onOpenTournaments,
}: PlayerStatsProps) {
  const { data, error, isLoading } = useQuery<PlayerStatsResponse>({
    queryKey: ['player', playerId, videogameId],
    queryFn: () =>
      requestStartgg<PlayerStatsResponse>(getPlayerStatsQuery, {
        playerId,
        videogameId,
      }),
  });
  if (isLoading) return <div>Cargando estadísticas...</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {getStartggErrorMessage(error)}
      </div>
    );
  }
  if (!data?.player) return null;

  const { player } = data;
  const allResults = [...(player.recentStandings ?? [])].sort(
    (a, b) => b.entrant.event.tournament.startAt - a.entrant.event.tournament.startAt
  );
  const results = filterStandingsByMode(allResults, tournamentMode);
  const bestPlacement =
    results.length > 0 ? Math.min(...results.map((result) => result.placement)) : null;
  const rankingCount = player.rankings?.length ?? 0;
  return (
    <Surface className="ui-profile">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Resultados visibles" value={results.length} />
        <SummaryCard
          label="Mejor placing reciente"
          value={bestPlacement ? `#${bestPlacement}` : 'N/D'}
          tone="accent"
        />
        <SummaryCard label="Rankings activos" value={rankingCount} tone="success" />
      </div>

      <div className="ui-content-section">
        <SectionTitle eyebrow="Últimos resultados" title="Standings recientes" />
        <button
          type="button"
          className="ui-action-button ui-action-button--small"
          onClick={onOpenTournaments}
        >
          Ver todos los torneos
        </button>
        <div className="ui-filter-group" aria-label="Filtrar torneos por modalidad">
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
        {results.length > 0 ? (
          <div className="ui-results-list">
            {results.map((result, index) => (
              <div
                key={`${result.entrant.event.tournament.name}-${result.entrant.event.name}-${index}`}
                className="ui-result-row"
              >
                <div className="font-medium">
                  {result.entrant.event.tournament.name} - {result.entrant.event.name}
                  <span className="ui-tournament-mode">
                    {result.entrant.event.tournament.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="ui-result-row__placement">#{result.placement}</div>
                <div className="ui-muted">
                  {formatEventDate(result.entrant.event.tournament.startAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ui-empty-state">
            Este jugador no tiene standings recientes visibles para este juego y modalidad.
          </div>
        )}
      </div>
    </Surface>
  );
}
