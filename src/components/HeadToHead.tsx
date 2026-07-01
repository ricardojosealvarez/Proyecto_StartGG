import { useQuery } from '@tanstack/react-query';
import {
  getStartggErrorMessage,
  headToHeadQuery,
  requestStartgg,
} from '../lib/api';
import { Swords } from 'lucide-react';
import { formatEventDate } from '../lib/format';
import { getSmashGameLabel } from '../lib/smash';
import { HeadToHeadResponse } from '../lib/types';
import { SummaryCard } from './SummaryCard';

interface HeadToHeadProps {
  player1Id: string;
  player2Id: string;
  videogameId: number;
}

export function HeadToHead({ player1Id, player2Id, videogameId }: HeadToHeadProps) {
  const { data, error, isLoading } = useQuery<HeadToHeadResponse>({
    queryKey: ['headToHead', player1Id, player2Id, videogameId],
    queryFn: () => requestStartgg<HeadToHeadResponse>(headToHeadQuery, { player1Id, player2Id }),
  });

  if (player1Id === player2Id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Selecciona dos jugadores distintos para comparar el historial de sets.
      </div>
    );
  }
  if (isLoading) return <div>Cargando comparación...</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {getStartggErrorMessage(error)}
      </div>
    );
  }
  if (!data?.player1 || !data.player2) return null;

  const { player1, player2 } = data;
  const selectedPlayerIds = new Set([player1Id, player2Id]);
  const setNodes = [...(player1.sets?.nodes ?? [])]
    .filter((set) => {
      const participantPlayerIds = new Set(
        (set.slots ?? [])
          .flatMap((slot) => slot.entrant?.participants ?? [])
          .map((participant) => participant.player?.id)
          .filter((playerId): playerId is string => Boolean(playerId))
      );

      if (participantPlayerIds.size !== 2) {
        return false;
      }

      return [...participantPlayerIds].every((playerId) => selectedPlayerIds.has(playerId));
    })
    .filter((set) => set.event.videogame?.id === videogameId)
    .sort((a, b) => b.event.tournament.startAt - a.event.tournament.startAt);

  const results = setNodes.reduce(
    (acc: { player1Wins: number; player2Wins: number }, set) => {
      if (String(set.winnerId) === player1Id) acc.player1Wins++;
      if (String(set.winnerId) === player2Id) acc.player2Wins++;
      return acc;
    },
    { player1Wins: 0, player2Wins: 0 }
  );

  const totalSets = setNodes.length;
  const advantageLabel =
    results.player1Wins === results.player2Wins
      ? 'Empate'
      : results.player1Wins > results.player2Wins
        ? player1.gamerTag
        : player2.gamerTag;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {player1.user?.images?.[0]?.url && (
            <img
              src={player1.user.images[0].url}
              alt={player1.gamerTag}
              className="w-16 h-16 rounded-full"
            />
          )}
          <div className="text-xl font-bold">{player1.gamerTag}</div>
        </div>
        <div className="flex items-center gap-4">
          <Swords className="w-8 h-8 text-gray-400" />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold">{player2.gamerTag}</div>
          {player2.user?.images?.[0]?.url && (
            <img
              src={player2.user.images[0].url}
              alt={player2.gamerTag}
              className="w-16 h-16 rounded-full"
            />
          )}
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-3xl font-bold">
          {results.player1Wins} - {results.player2Wins}
        </div>
        <div className="text-gray-600">Historial de enfrentamientos</div>
        <div className="mt-1 text-sm text-blue-700">
          Filtrado para {getSmashGameLabel(videogameId)}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Sets visibles" value={totalSets} />
        <SummaryCard label="Ventaja" value={advantageLabel} tone="accent" />
        <SummaryCard
          label="Último score"
          value={setNodes[0]?.displayScore ?? 'N/D'}
          tone="success"
        />
      </div>

      {setNodes.length > 0 ? (
        <div className="space-y-3">
          {setNodes.map((set) => (
            <div
              key={set.id}
              className="bg-gray-50 p-4 rounded-lg"
            >
              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="font-medium">
                    {set.event.tournament.name} - {set.event.name}
                  </div>
                  {set.fullRoundText && (
                    <div className="text-sm text-gray-500">{set.fullRoundText}</div>
                  )}
                </div>
                <div className="text-lg font-bold">{set.displayScore ?? 'Sin score visible'}</div>
              </div>
              <div className="text-sm text-gray-500">
                {formatEventDate(set.event.tournament.startAt)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No hay sets visibles entre estos jugadores para {getSmashGameLabel(videogameId)}.
        </div>
      )}
    </div>
  );
}
