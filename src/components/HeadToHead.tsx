import { useQuery } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { getLocalHeadToHead } from '../lib/api';
import { formatEventDate } from '../lib/format';
import { getSmashGameLabel } from '../lib/smash';
import { SummaryCard } from './SummaryCard';

interface HeadToHeadProps {
  player1Id: string;
  player2Id: string;
  videogameId: number;
}

export function HeadToHead({ player1Id, player2Id, videogameId }: HeadToHeadProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['localHeadToHead', player1Id, player2Id, videogameId],
    queryFn: () => getLocalHeadToHead(player1Id, player2Id, videogameId),
  });

  if (player1Id === player2Id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Selecciona dos jugadores distintos para comparar el historial de sets.
      </div>
    );
  }
  if (isLoading) return <div>Cargando historial local completo...</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error instanceof Error ? error.message : 'No se pudo consultar el historial local.'}
      </div>
    );
  }

  const sets = data?.sets ?? [];
  const player1Tag = sets[0]?.player1Tag ?? `Player ${player1Id}`;
  const player2Tag = sets[0]?.player2Tag ?? `Player ${player2Id}`;
  const results = sets.reduce(
    (wins, set) => {
      if (set.winnerPlayerId === player1Id) wins.player1 += 1;
      if (set.winnerPlayerId === player2Id) wins.player2 += 1;
      return wins;
    },
    { player1: 0, player2: 0 }
  );
  const advantageLabel =
    results.player1 === results.player2
      ? 'Empate'
      : results.player1 > results.player2
        ? player1Tag
        : player2Tag;

  return (
    <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-xl font-bold">{player1Tag}</div>
        <Swords className="h-8 w-8 text-gray-400" />
        <div className="text-xl font-bold">{player2Tag}</div>
      </div>

      <div className="mb-6 text-center">
        <div className="text-3xl font-bold">
          {results.player1} - {results.player2}
        </div>
        <div className="text-gray-600">Historial local completo</div>
        <div className="mt-1 text-sm text-blue-700">
          Filtrado para {getSmashGameLabel(videogameId)}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Sets guardados" value={sets.length} />
        <SummaryCard label="Ventaja" value={advantageLabel} tone="accent" />
        <SummaryCard label="Último score" value={sets[0]?.displayScore ?? 'N/D'} tone="success" />
      </div>

      {sets.length > 0 ? (
        <div className="space-y-3">
          {sets.map((set) => (
            <div key={set.id} className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {set.tournamentName} - {set.eventName}
                  </div>
                </div>
                <div className="text-lg font-bold">{set.displayScore ?? 'Sin score visible'}</div>
              </div>
              <div className="text-sm text-gray-500">
                {formatEventDate(Math.floor(new Date(set.completedAt).getTime() / 1000))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No hay sets importados entre estos jugadores para {getSmashGameLabel(videogameId)}.
        </div>
      )}
    </div>
  );
}
