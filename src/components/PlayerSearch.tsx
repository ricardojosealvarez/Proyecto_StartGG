import { useState } from 'react';
import { Clock3, Loader2, Search, UserCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  currentUserPlayerQuery,
  getStartggErrorMessage,
  requestStartgg,
  resolvePlayerByIdQuery,
  resolvePlayerByUserSlugQuery,
} from '../lib/api';
import {
  CurrentUserResponse,
  PlayerSummary,
  ResolvePlayerResponse,
  ResolveUserResponse,
} from '../lib/types';

interface PlayerSearchProps {
  label?: string;
  selectedPlayer?: PlayerSummary | null;
  onPlayerSelect: (player: PlayerSummary) => void;
  onClearSelection?: () => void;
  recentPlayers?: PlayerSummary[];
}

function isNumericPlayerId(value: string) {
  return /^\d+$/.test(value);
}

function isUserSlug(value: string) {
  return value.startsWith('user/');
}

function normalizeLookupValue(value: string) {
  const trimmedValue = value.trim();

  if (isNumericPlayerId(trimmedValue) || trimmedValue.startsWith('user/')) {
    return trimmedValue;
  }

  if (trimmedValue.includes('start.gg/user/')) {
    return trimmedValue.split('start.gg/')[1] ?? trimmedValue;
  }

  return trimmedValue;
}

export function PlayerSearch({
  label,
  selectedPlayer,
  onPlayerSelect,
  onClearSelection,
  recentPlayers = [],
}: PlayerSearchProps) {
  const [search, setSearch] = useState('');
  const normalizedLookupValue = normalizeLookupValue(search);
  const lookupIsPlayerId = isNumericPlayerId(normalizedLookupValue);
  const lookupIsUserSlug = isUserSlug(normalizedLookupValue);

  const { data, error, isFetching } = useQuery<PlayerSummary | null>({
    queryKey: ['playerLookup', normalizedLookupValue],
    queryFn: async () => {
      if (!normalizedLookupValue) return null;

      if (lookupIsPlayerId) {
        const response = await requestStartgg<ResolvePlayerResponse>(resolvePlayerByIdQuery, {
          playerId: normalizedLookupValue,
        });
        return response.player;
      }

      const response = await requestStartgg<ResolveUserResponse>(
        resolvePlayerByUserSlugQuery,
        {
          slug: normalizedLookupValue,
        }
      );

      if (!response.user?.player) return null;

      return {
        ...response.user.player,
        user: {
          bio: response.user.bio ?? null,
          images: response.user.images ?? null,
          slug: response.user.slug ?? normalizedLookupValue,
        },
      };
    },
    enabled: normalizedLookupValue.length > 0,
  });

  const {
    refetch: refetchCurrentUser,
    isFetching: isFetchingCurrentUser,
  } = useQuery<CurrentUserResponse>({
    queryKey: ['currentUserPlayer'],
    queryFn: () => requestStartgg<CurrentUserResponse>(currentUserPlayerQuery),
    enabled: false,
  });

  const lookupTypeLabel = lookupIsPlayerId
    ? 'Detectado como playerId'
    : lookupIsUserSlug
      ? 'Detectado como user slug'
      : normalizedLookupValue.includes('start.gg/user/')
        ? 'Detectado como URL de perfil'
        : null;

  return (
    <div className="w-full max-w-md">
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      )}

      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Player ID o user slug de Start.gg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            const response = await refetchCurrentUser();
            const currentUser = response.data?.currentUser;

            if (!currentUser?.player) {
              return;
            }

            const resolvedPlayer = {
              ...currentUser.player,
              user: {
                bio: currentUser.bio ?? null,
                images: currentUser.images ?? null,
                slug: currentUser.slug ?? null,
              },
            };

            onPlayerSelect({
              ...resolvedPlayer,
              id: String(resolvedPlayer.id),
            });
            setSearch(currentUser.slug ?? String(currentUser.player.id));
          }}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {isFetchingCurrentUser ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCircle2 className="h-4 w-4" />
          )}
          Usar mi perfil
        </button>

        {lookupTypeLabel && (
          <div className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
            {lookupTypeLabel}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Jugador seleccionado
            </div>
            <div className="font-medium text-gray-900">{selectedPlayer.gamerTag}</div>
            <div className="text-sm text-blue-800">
              {selectedPlayer.user?.slug ?? `Player ID ${selectedPlayer.id}`}
            </div>
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

      {recentPlayers.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock3 className="h-4 w-4" />
            Recientes
          </div>
          <div className="flex flex-wrap gap-2">
            {recentPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  onPlayerSelect(player);
                  setSearch(player.user?.slug ?? player.id);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {player.gamerTag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
        <div>Formatos válidos:</div>
        <div className="mt-1 font-mono text-xs text-slate-700">2724258</div>
        <div className="mt-1 font-mono text-xs text-slate-700">user/e4bc09eb</div>
        <div className="mt-1 font-mono text-xs text-slate-700">https://start.gg/user/e4bc09eb</div>
      </div>

      {isFetching && (
        <div className="mt-2 text-center text-gray-600">Resolviendo jugador...</div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getStartggErrorMessage(error)}
        </div>
      )}

      {data && (
        <div className="mt-2 bg-white rounded-lg shadow-lg">
          <button
            className="w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3"
            onClick={() => {
              onPlayerSelect({
                ...data,
                id: String(data.id),
              });
              setSearch(data.user?.slug ?? data.gamerTag);
            }}
          >
            {data.user?.images?.[0]?.url && (
              <img
                src={data.user.images[0].url}
                alt={data.gamerTag}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <div className="font-medium">{data.gamerTag}</div>
              <div className="text-sm text-gray-600">
                Player ID: {data.id}
                {data.user?.slug ? ` · ${data.user.slug}` : ''}
              </div>
            </div>
          </button>
        </div>
      )}

      {normalizedLookupValue.length > 0 && !isFetching && !error && !data && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          No encontré un jugador para ese `playerId` o `user slug`.
        </div>
      )}
    </div>
  );
}
