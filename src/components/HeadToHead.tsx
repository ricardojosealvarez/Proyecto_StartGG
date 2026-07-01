import { useQuery } from '@tanstack/react-query';
import { client, headToHeadQuery } from '../lib/api';
import { Swords } from 'lucide-react';
import { formatEventDate } from '../lib/format';
import { HeadToHeadResponse } from '../lib/types';

interface HeadToHeadProps {
  player1Id: string;
  player2Id: string;
}

export function HeadToHead({ player1Id, player2Id }: HeadToHeadProps) {
  const { data, error, isLoading } = useQuery<HeadToHeadResponse>({
    queryKey: ['headToHead', player1Id, player2Id],
    queryFn: () => client.request<HeadToHeadResponse>(headToHeadQuery, { player1Id, player2Id }),
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
        No pude cargar el head-to-head desde Start.gg.
      </div>
    );
  }
  if (!data) return null;

  const { player1, player2, sets } = data;
  const setNodes = sets?.nodes ?? [];

  const results = setNodes.reduce(
    (acc: { player1Wins: number; player2Wins: number }, set) => {
      if (String(set.winnerId) === player1Id) acc.player1Wins++;
      if (String(set.winnerId) === player2Id) acc.player2Wins++;
      return acc;
    },
    { player1Wins: 0, player2Wins: 0 }
  );

  if (!player1 || !player2) return null;

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
      </div>

      {setNodes.length > 0 ? (
        <div className="space-y-3">
          {setNodes.map((set, index) => (
            <div
              key={`${set.event.tournament.name}-${set.event.name}-${index}`}
              className="bg-gray-50 p-4 rounded-lg"
            >
              <div className="flex justify-between items-center gap-4">
                <div className="font-medium">
                  {set.event.tournament.name} - {set.event.name}
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
          No hay sets visibles entre estos jugadores en la consulta actual.
        </div>
      )}
    </div>
  );
}
