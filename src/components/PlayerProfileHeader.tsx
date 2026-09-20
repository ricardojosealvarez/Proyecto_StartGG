import { BarChart3, RefreshCw, Trophy } from 'lucide-react';
import { getPlayerAvatarUrl } from '../lib/api';
import { getSmashGameLabel } from '../lib/smash';
import type {
  PlayerCharacterStats,
  PlayerHistoryRefreshResponse,
  Ranking,
  PlayerSummary,
} from '../lib/types';
import { PlayerAvatar } from './DesignSystem';

interface PlayerProfileHeaderProps {
  player: PlayerSummary;
  videogameId: number;
  characterStats?: PlayerCharacterStats | null;
  isLoadingCharacterStats: boolean;
  rankings?: Ranking[] | null;
  isLoadingRankings?: boolean;
  onOpenAnalytics: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canRefresh?: boolean;
  refreshData?: PlayerHistoryRefreshResponse;
  refreshError?: unknown;
}

export function PlayerProfileHeader({
  player,
  videogameId,
  characterStats,
  isLoadingCharacterStats,
  rankings,
  isLoadingRankings = false,
  onOpenAnalytics,
  onRefresh,
  isRefreshing,
  canRefresh = true,
  refreshData,
  refreshError,
}: PlayerProfileHeaderProps) {
  const featuredCharacters = characterStats?.primaryCharacter
    ? [characterStats.primaryCharacter, ...characterStats.secondaryCharacters]
    : [];

  return (
    <section className="player-profile-header">
      <div className="player-profile-header__identity">
        <PlayerAvatar
          gamerTag={player.gamerTag}
          imageUrl={getPlayerAvatarUrl(player.user?.images)}
          size="large"
        />
        <div className="player-profile-header__details">
          <div className="ui-eyebrow">Información del jugador</div>
          <h2>{player.gamerTag}</h2>
          {player.user?.bio && <p>{player.user.bio}</p>}
          <span className="ui-chip">{getSmashGameLabel(videogameId)}</span>
        </div>
      </div>

      {featuredCharacters.length > 0 ? (
        <div className="player-profile-header__characters">
          {featuredCharacters.map((character, index) => (
            <div className="player-profile-header__character" key={character.characterId}>
              {character.imageUrl && <img src={character.imageUrl} alt={character.name} />}
              <div>
                <div className="ui-eyebrow">
                  {index === 0
                    ? characterStats?.characterConfidence === 'low'
                      ? 'Más utilizado · datos limitados'
                      : 'Principal estimado'
                    : 'Personaje complementario'}
                </div>
                <strong>{character.name}</strong>
                <span>{Math.round(character.usage * 100)} % de uso</span>
              </div>
            </div>
          ))}
        </div>
      ) : isLoadingCharacterStats ? (
        <div className="player-profile-header__character player-profile-header__character--loading">
          Calculando personaje…
        </div>
      ) : null}

      <div className="player-profile-header__actions">
        <button
          type="button"
          className="ui-action-button ui-action-button--small"
          onClick={onOpenAnalytics}
        >
          <BarChart3 className="h-4 w-4" />
          Ver estadísticas
        </button>
        {canRefresh && (
          <button
            type="button"
            className="ui-action-button ui-action-button--small"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4${isRefreshing ? ' is-spinning' : ''}`} />
            {isRefreshing ? `Actualizando ${player.gamerTag}` : 'Actualizar'}
          </button>
        )}
      </div>

      <div className="player-profile-header__rankings">
        <div className="ui-eyebrow">Rankings</div>
        {isLoadingRankings ? (
          <div className="player-profile-header__rankings-empty">Cargando rankings…</div>
        ) : rankings?.length ? (
          <div className="player-profile-header__ranking-list">
            {rankings.map((ranking) => (
              <div
                key={`${ranking.title}-${ranking.rank}`}
                className="player-profile-header__ranking"
              >
                <Trophy aria-hidden="true" />
                <span>{ranking.title}</span>
                <strong>#{ranking.rank}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="player-profile-header__rankings-empty">
            No hay rankings visibles para este jugador en {getSmashGameLabel(videogameId)}.
          </div>
        )}
      </div>

      {refreshData && (
        <div className="ui-refresh-status" role="status">
          {refreshData.tournamentsSaved} torneos y {refreshData.setsSaved} sets sincronizados.
        </div>
      )}
      {Boolean(refreshError) && (
        <div className="ui-refresh-status ui-refresh-status--error" role="alert">
          {refreshError instanceof Error
            ? refreshError.message
            : 'No se pudo actualizar el jugador.'}
        </div>
      )}
    </section>
  );
}
