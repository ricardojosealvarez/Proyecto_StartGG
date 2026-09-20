import { useQuery } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { getLocalHeadToHead } from '../lib/api';
import { formatEventDate } from '../lib/format';
import { getSmashGameLabel } from '../lib/smash';
import { groupHeadToHeadSetsByTournament } from '../lib/headToHead';
import { SummaryCard } from './SummaryCard';
import { SectionTitle, Surface } from './DesignSystem';

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
  const tournaments = data?.tournaments ?? [];
  const tournamentRows = groupHeadToHeadSetsByTournament(tournaments, sets);
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
    <Surface className="ui-head-to-head">
      <div className="ui-pixel-pattern" aria-hidden="true" />
      <SectionTitle
        eyebrow="Historial de enfrentamientos"
        title="Comparación directa"
        description={`Sets importados de ${getSmashGameLabel(videogameId)}`}
      />

      <div className="ui-versus">
        <div className="ui-versus__player">{player1Tag}</div>
        <div className="ui-versus__score">
          <Swords className="h-5 w-5" />
          <strong>{results.player1}</strong>
          <span>—</span>
          <strong>{results.player2}</strong>
        </div>
        <div className="ui-versus__player ui-versus__player--right">{player2Tag}</div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Sets guardados" value={sets.length} />
        <SummaryCard label="Ventaja" value={advantageLabel} tone="accent" />
        <SummaryCard label="Último score" value={sets[0]?.displayScore ?? 'N/D'} tone="success" />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-semibold">Torneos compartidos</h3>
        {tournamentRows.length > 0 ? (
          <div className="ui-tournament-table-wrap">
            <table className="ui-tournament-table">
              <thead>
                <tr>
                  <th scope="col">Torneos donde han coincidido</th>
                  <th scope="col">H2H</th>
                </tr>
              </thead>
              <tbody>
                {tournamentRows.map((tournament) => (
                  <tr key={tournament.id}>
                    <td>
                      <div className="font-medium">{tournament.name}</div>
                      <div className="ui-muted">
                        {formatEventDate(
                          Math.floor(new Date(tournament.startsAt).getTime() / 1000)
                        )}
                      </div>
                    </td>
                    <td>
                      {tournament.results.length > 0 ? (
                        <div className="ui-tournament-table__results">
                          {tournament.results.map((set) => (
                            <div key={set.id}>
                              <span className="ui-muted">{set.eventName}</span>
                              <strong>{set.displayScore ?? 'Sin score visible'}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="ui-muted">No se llegaron a enfrentar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ui-empty-state">No hay torneos en común registrados.</div>
        )}
      </div>
    </Surface>
  );
}
