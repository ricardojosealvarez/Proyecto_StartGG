import { useQuery } from '@tanstack/react-query';
import {
  getPlayerStatsQuery,
  getStartggErrorMessage,
  requestStartgg,
} from '../lib/api';
import { Trophy } from 'lucide-react';
import { formatEventDate } from '../lib/format';
import { PlayerStatsResponse } from '../lib/types';
import { getSmashGameLabel } from '../lib/smash';
import { SummaryCard } from './SummaryCard';

interface PlayerStatsProps {
  playerId: string;
  videogameId: number;
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
  const bestPlacement = results.length > 0
    ? Math.min(...results.map((result) => result.placement))
    : null;
  const rankingCount = player.rankings?.length ?? 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
      <div className="flex items-center gap-4 mb-6">
        {player.user?.images?.[0]?.url && (
          <img
            src={player.user.images[0].url}
            alt={player.gamerTag}
            className="w-20 h-20 rounded-full"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold">{player.gamerTag}</h2>
          {player.user?.bio && (
            <p className="text-gray-600 mt-1">{player.user.bio}</p>
          )}
          <p className="mt-2 text-sm text-blue-700">
            Vista filtrada para {getSmashGameLabel(videogameId)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Resultados visibles" value={results.length} />
        <SummaryCard
          label="Mejor placing reciente"
          value={bestPlacement ? `#${bestPlacement}` : 'N/D'}
          tone="accent"
        />
        <SummaryCard
          label="Rankings activos"
          value={rankingCount}
          tone="success"
        />
      </div>

      {player.rankings?.length ? (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Rankings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {player.rankings.map((ranking) => (
              <div
                key={`${ranking.title}-${ranking.rank}`}
                className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg"
              >
                <Trophy className="text-yellow-500" />
                <div>
                  <div className="font-medium">{ranking.title}</div>
                  <div className="text-sm text-gray-600">Rank #{ranking.rank}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No hay rankings visibles para este jugador en {getSmashGameLabel(videogameId)}.
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-2">Standings recientes</h3>
        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={`${result.entrant.event.tournament.name}-${result.entrant.event.name}-${index}`}
                className="bg-gray-50 p-3 rounded-lg"
              >
                <div className="font-medium">
                  {result.entrant.event.tournament.name} - {result.entrant.event.name}
                </div>
                <div className="text-sm text-gray-600">
                  Posición: #{result.placement}
                </div>
                <div className="text-sm text-gray-500">
                  {formatEventDate(result.entrant.event.tournament.startAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Este jugador no tiene standings recientes visibles para este juego.
          </div>
        )}
      </div>
    </div>
  );
}
