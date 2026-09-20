import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getTournaments } from '../lib/api';
import type { TournamentMode } from '../lib/tournamentMode';
import type { PlayerSummary } from '../lib/types';
import { SectionTitle, Surface } from './DesignSystem';

interface TournamentListProps {
  player: PlayerSummary;
  videogameId: number;
  tournamentMode: TournamentMode;
  onTournamentModeChange: (mode: TournamentMode) => void;
  onBack: () => void;
}

export function TournamentList({
  player,
  videogameId,
  tournamentMode,
  onTournamentModeChange,
  onBack,
}: TournamentListProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['tournaments', player.id, videogameId, tournamentMode],
    queryFn: () => getTournaments(player.id, videogameId, tournamentMode),
  });

  return (
    <div className="analytics-page">
      <button type="button" className="ui-action-button" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Volver al perfil
      </button>
      <Surface>
        <SectionTitle eyebrow={player.gamerTag} title="Todos los torneos del jugador" />
        <div className="ui-filter-group" aria-label="Filtrar torneos por modalidad">
          {(
            [
              ['all', 'Todos'],
              ['offline', 'Offline'],
              ['online', 'Online'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`ui-chip ui-chip--button${tournamentMode === mode ? ' is-active' : ''}`}
              aria-pressed={tournamentMode === mode}
              onClick={() => onTournamentModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {isLoading && <div>Cargando torneos...</div>}
        {error && <div className="ui-empty-state">No se pudieron cargar los torneos.</div>}
        {data && (
          <>
            <div className="ui-muted ui-tournament-count">{data.tournaments.length} torneos</div>
            <div className="ui-results-list">
              {data.tournaments.map((tournament) => (
                <div key={tournament.id} className="ui-result-row ui-result-row__main">
                  <div>
                    <div className="font-medium">
                      {tournament.name}
                      <span className="ui-tournament-mode">
                        {tournament.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="ui-muted">
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                        new Date(tournament.startsAt)
                      )}
                      {tournament.countryCode ? ` · ${tournament.countryCode}` : ''}
                      {tournament.tier ? ` · Tier ${tournament.tier}` : ''}
                    </div>
                  </div>
                  {tournament.slug && (
                    <a
                      className="ui-text-button"
                      href={`https://www.start.gg/${tournament.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Start.gg <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}
