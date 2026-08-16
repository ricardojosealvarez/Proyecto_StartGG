import { useQuery } from '@tanstack/react-query';
import {
  getPlayerCharacterStats,
  getPlayerStatsQuery,
  getStartggErrorMessage,
  requestStartgg,
} from '../lib/api';
import { Trophy } from 'lucide-react';
import { formatEventDate } from '../lib/format';
import { PlayerCharacterStats, PlayerStatsResponse } from '../lib/types';
import { getSmashGameLabel } from '../lib/smash';
import { SummaryCard } from './SummaryCard';
import { PlayerAvatar, SectionTitle, Surface } from './DesignSystem';

interface PlayerStatsProps {
  playerId: string;
  videogameId: number;
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

export function PlayerStats({ playerId, videogameId }: PlayerStatsProps) {
  const { data, error, isLoading } = useQuery<PlayerStatsResponse>({
    queryKey: ['player', playerId, videogameId],
    queryFn: () =>
      requestStartgg<PlayerStatsResponse>(getPlayerStatsQuery, {
        playerId,
        videogameId,
      }),
  });
  const { data: characterStats, isLoading: isLoadingCharacterStats } = useQuery({
    queryKey: ['playerCharacters', playerId, videogameId],
    queryFn: () => getPlayerCharacterStats(playerId, videogameId),
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
  const results = [...(player.recentStandings ?? [])].sort(
    (a, b) => b.entrant.event.tournament.startAt - a.entrant.event.tournament.startAt
  );
  const bestPlacement =
    results.length > 0 ? Math.min(...results.map((result) => result.placement)) : null;
  const rankingCount = player.rankings?.length ?? 0;
  const featuredCharacters = characterStats?.primaryCharacter
    ? [characterStats.primaryCharacter, ...characterStats.secondaryCharacters]
    : [];

  return (
    <Surface className="ui-profile">
      <div className="ui-profile__hero">
        <div className="ui-pixel-pattern" aria-hidden="true" />
        <PlayerAvatar
          gamerTag={player.gamerTag}
          imageUrl={player.user?.images?.[0]?.url}
          size="large"
        />
        <div className="ui-profile__identity">
          <div className="ui-eyebrow">Información del jugador</div>
          <h2>{player.gamerTag}</h2>
          {player.user?.bio && <p>{player.user.bio}</p>}
          <span className="ui-chip">{getSmashGameLabel(videogameId)}</span>
        </div>
        {featuredCharacters.length > 0 && (
          <div className="ui-profile__characters">
            {featuredCharacters.map((character, index) => (
              <div key={character.characterId} className="ui-profile__character">
                {character.imageUrl && <img src={character.imageUrl} alt={character.name} />}
                <div>
                  <div className="ui-eyebrow">
                    {index === 0 ? 'Principal estimado' : 'Complementario'}
                  </div>
                  <strong>{character.name}</strong>
                  <span>{Math.round(character.usage * 100)} % de uso</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {isLoadingCharacterStats && (
          <div className="ui-profile__character ui-profile__character--loading">
            Calculando personaje más utilizado…
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Resultados visibles" value={results.length} />
        <SummaryCard
          label="Mejor placing reciente"
          value={bestPlacement ? `#${bestPlacement}` : 'N/D'}
          tone="accent"
        />
        <SummaryCard label="Rankings activos" value={rankingCount} tone="success" />
      </div>

      {characterStats && (
        <div className="ui-content-section">
          <SectionTitle eyebrow="Selecciones registradas en Start.gg" title="Personajes" />
          <PlayerCharacterSummary stats={characterStats} />
        </div>
      )}

      {player.rankings?.length ? (
        <div className="ui-content-section">
          <SectionTitle eyebrow="Clasificaciones destacadas" title="Rankings" />
          <div className="ui-card-grid">
            {player.rankings.map((ranking) => (
              <div key={`${ranking.title}-${ranking.rank}`} className="ui-list-card">
                <Trophy className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="font-medium">{ranking.title}</div>
                  <div className="ui-muted">Rank #{ranking.rank}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="ui-empty-state">
          No hay rankings visibles para este jugador en {getSmashGameLabel(videogameId)}.
        </div>
      )}

      <div className="ui-content-section">
        <SectionTitle eyebrow="Últimos resultados" title="Standings recientes" />
        {results.length > 0 ? (
          <div className="ui-results-list">
            {results.map((result, index) => (
              <div
                key={`${result.entrant.event.tournament.name}-${result.entrant.event.name}-${index}`}
                className="ui-result-row"
              >
                <div className="font-medium">
                  {result.entrant.event.tournament.name} - {result.entrant.event.name}
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
            Este jugador no tiene standings recientes visibles para este juego.
          </div>
        )}
      </div>
    </Surface>
  );
}
