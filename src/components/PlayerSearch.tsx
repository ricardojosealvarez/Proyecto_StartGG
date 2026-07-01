import { useState } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { client, searchPlayerQuery } from '../lib/api';
import { PlayerSummary, SearchPlayersResponse } from '../lib/types';

interface PlayerSearchProps {
  label?: string;
  selectedPlayer?: PlayerSummary | null;
  onPlayerSelect: (player: PlayerSummary) => void;
  onClearSelection?: () => void;
}

export function PlayerSearch({
  label,
  selectedPlayer,
  onPlayerSelect,
  onClearSelection,
}: PlayerSearchProps) {
  const [search, setSearch] = useState('');
  const trimmedSearch = search.trim();

  const { data, error, isFetching } = useQuery<SearchPlayersResponse | null>({
    queryKey: ['players', trimmedSearch],
    queryFn: async () => {
      if (!trimmedSearch) return null;
      return client.request<SearchPlayersResponse>(searchPlayerQuery, {
        query: trimmedSearch,
      });
    },
    enabled: trimmedSearch.length > 2,
  });

  const players = data?.players?.nodes ?? [];
  const showResults = trimmedSearch.length > 2 && (players.length > 0 || Boolean(error));

  return (
    <div className="w-full max-w-md">
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      )}

      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar jugador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>

      {selectedPlayer && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Jugador seleccionado
            </div>
            <div className="font-medium text-gray-900">{selectedPlayer.gamerTag}</div>
          </div>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-md px-2 py-1 text-sm text-blue-700 hover:bg-blue-100"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {trimmedSearch.length > 0 && trimmedSearch.length < 3 && (
        <div className="mt-2 text-sm text-gray-500">
          Escribe al menos 3 caracteres para buscar tags de Smash.
        </div>
      )}

      {isFetching && (
        <div className="mt-2 text-center text-gray-600">Buscando jugadores...</div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo consultar Start.gg. Revisa la API key de pruebas o vuelve a intentarlo.
        </div>
      )}

      {showResults && (
        <div className="mt-2 bg-white rounded-lg shadow-lg">
          {players.map((player) => (
            <button
              key={player.id}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
              onClick={() => {
                onPlayerSelect({
                  ...player,
                  id: String(player.id),
                });
                setSearch(player.gamerTag);
              }}
            >
              {player.user?.images?.[0]?.url && (
                <img
                  src={player.user.images[0].url}
                  alt={player.gamerTag}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <div className="font-medium">{player.gamerTag}</div>
                {player.rankings?.[0] && (
                  <div className="text-sm text-gray-600">
                    Rank #{player.rankings[0].rank} - {player.rankings[0].title}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {trimmedSearch.length > 2 && !isFetching && !error && players.length === 0 && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          No encontré jugadores para ese tag. Prueba con otro alias o una búsqueda más corta.
        </div>
      )}
    </div>
  );
}
