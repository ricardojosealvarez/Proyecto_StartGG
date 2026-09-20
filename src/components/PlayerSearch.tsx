import { useDeferredValue, useState } from 'react';
import { Clock3, Loader2, Search, UserCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  currentUserPlayerQuery,
  getPlayerAvatarUrl,
  getPlayerSearchErrorMessage,
  normalizeStartggUserSlug,
  requestStartgg,
  resolvePlayerByIdQuery,
  resolvePlayerByUserSlug,
  searchPlayersByName,
} from '../lib/api';
import { CurrentUserResponse, PlayerSummary, ResolvePlayerResponse } from '../lib/types';

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

interface PlayerSearchResultsProps {
  players: PlayerSummary[];
  onSelect: (player: PlayerSummary) => void;
}

export function PlayerSearchResults({ players, onSelect }: PlayerSearchResultsProps) {
  return (
    <div className="player-search__results">
      {players.map((player) => {
        const avatarUrl = getPlayerAvatarUrl(player.user?.images);

        return (
          <button
            key={player.id}
            type="button"
            className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-gray-100 last:border-b-0"
            onClick={() => onSelect(player)}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={player.gamerTag} className="h-10 w-10 rounded-full" />
            ) : (
              <UserCircle2 className="h-10 w-10 text-slate-500" aria-hidden="true" />
            )}
            <div>
              <div className="font-medium">{player.gamerTag}</div>
              <div className="text-sm text-gray-600">
                Player ID: {player.id}
                {player.user?.slug ? ` · ${player.user.slug}` : ''}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function PlayerSearch({
  label,
  selectedPlayer,
  onPlayerSelect,
  onClearSelection,
  recentPlayers = [],
}: PlayerSearchProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const normalizedLookupValue = normalizeLookupValue(deferredSearch);
  const lookupIsPlayerId = isNumericPlayerId(normalizedLookupValue);
  const lookupIsUserSlug = isUserSlug(normalizedLookupValue);
  const directLookupEnabled =
    normalizedLookupValue.length > 0 && (lookupIsPlayerId || lookupIsUserSlug);
  const playerNameSearchEnabled = normalizedLookupValue.length >= 2 && !directLookupEnabled;

  const {
    data: directLookupResult,
    error: directLookupError,
    isFetching: isFetchingDirectLookup,
  } = useQuery<PlayerSummary | null>({
    queryKey: ['playerLookup', normalizedLookupValue],
    queryFn: async () => {
      const response = await requestStartgg<ResolvePlayerResponse>(resolvePlayerByIdQuery, {
        playerId: normalizedLookupValue,
      });

      if (!response.player) {
        return null;
      }

      return {
        ...response.player,
        id: String(response.player.id),
        user: response.player.user
          ? {
              ...response.player.user,
              slug: normalizeStartggUserSlug(response.player.user.slug),
            }
          : response.player.user,
      };
    },
    enabled: directLookupEnabled && lookupIsPlayerId,
  });

  const {
    data: directUserSlugResult,
    error: directUserSlugError,
    isFetching: isFetchingDirectUserSlug,
  } = useQuery<PlayerSummary | null>({
    queryKey: ['playerLookupByUserSlug', normalizedLookupValue],
    queryFn: () => resolvePlayerByUserSlug(normalizedLookupValue),
    enabled: directLookupEnabled && lookupIsUserSlug,
  });

  const {
    data: playerNameResults = [],
    error: playerNameSearchError,
    isFetching: isFetchingPlayerNameSearch,
  } = useQuery<PlayerSummary[]>({
    queryKey: ['playerSearchByName', normalizedLookupValue],
    queryFn: () => searchPlayersByName(normalizedLookupValue),
    enabled: playerNameSearchEnabled,
  });

  const { refetch: refetchCurrentUser, isFetching: isFetchingCurrentUser } =
    useQuery<CurrentUserResponse>({
      queryKey: ['currentUserPlayer'],
      queryFn: () => requestStartgg<CurrentUserResponse>(currentUserPlayerQuery),
      enabled: false,
    });

  const directResult = directLookupResult ?? directUserSlugResult ?? null;
  const directError = directLookupError ?? directUserSlugError ?? null;
  const isFetchingDirectResult = isFetchingDirectLookup || isFetchingDirectUserSlug;

  const lookupTypeLabel = lookupIsPlayerId
    ? 'Detectado como playerId'
    : lookupIsUserSlug
      ? 'Detectado como user slug'
      : normalizedLookupValue.includes('start.gg/user/')
        ? 'Detectado como URL de perfil'
        : null;

  return (
    <div className="player-search">
      {label && <label className="player-search__label">{label}</label>}

      <div className="relative">
        <input
          type="text"
          className="player-search__input"
          placeholder="Nombre, player ID o user slug de Start.gg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search className="player-search__search-icon" />
      </div>

      {(isFetchingDirectResult || isFetchingPlayerNameSearch) && (
        <div className="mt-2 text-center text-gray-600">
          {directLookupEnabled ? 'Resolviendo jugador...' : 'Buscando jugadores...'}
        </div>
      )}

      {directError && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getPlayerSearchErrorMessage(directError)}
        </div>
      )}

      {playerNameSearchError && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getPlayerSearchErrorMessage(playerNameSearchError)}
        </div>
      )}

      {directResult && !selectedPlayer && (
        <PlayerSearchResults
          players={[directResult]}
          onSelect={(player) => {
            onPlayerSelect({ ...player, id: String(player.id) });
            setSearch(player.user?.slug ?? player.gamerTag);
          }}
        />
      )}

      {playerNameResults.length > 0 && !selectedPlayer && (
        <PlayerSearchResults
          players={playerNameResults}
          onSelect={(player) => {
            onPlayerSelect(player);
            setSearch(player.user?.slug ?? player.gamerTag);
          }}
        />
      )}

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
                slug: normalizeStartggUserSlug(currentUser.slug),
              },
            };

            onPlayerSelect({
              ...resolvedPlayer,
              id: String(resolvedPlayer.id),
            });
            setSearch(normalizeStartggUserSlug(currentUser.slug) ?? String(currentUser.player.id));
          }}
          className="ui-action-button ui-action-button--small"
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
        <div className="player-search__selection">
          <div>
            <div className="ui-eyebrow">Jugador seleccionado</div>
            <div className="font-medium">{selectedPlayer.gamerTag}</div>
            <div className="ui-muted">
              {selectedPlayer.user?.slug ?? `Player ID ${selectedPlayer.id}`}
            </div>
          </div>
          {onClearSelection && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                onClearSelection();
              }}
              className="ui-text-button"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {recentPlayers.length > 0 && (
        <div className="player-search__recent">
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
                className="ui-chip ui-chip--button"
              >
                {player.gamerTag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="player-search__help">
        <div>Formatos válidos:</div>
        <div className="mt-1 text-xs text-slate-700">MkLeo</div>
        <div className="mt-1 font-mono text-xs text-slate-700">2724258</div>
        <div className="mt-1 font-mono text-xs text-slate-700">user/e4bc09eb</div>
        <div className="mt-1 font-mono text-xs text-slate-700">https://start.gg/user/e4bc09eb</div>
      </div>

      {directLookupEnabled && !isFetchingDirectResult && !directError && !directResult && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          No encontré un jugador para ese `playerId` o `user slug`.
        </div>
      )}

      {playerNameSearchEnabled &&
        !isFetchingPlayerNameSearch &&
        !playerNameSearchError &&
        playerNameResults.length === 0 && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            No encontré perfiles de Start.gg para ese nombre. Prueba con más caracteres o con el
            `playerId`/`user slug` si ya lo conoces.
          </div>
        )}
    </div>
  );
}
