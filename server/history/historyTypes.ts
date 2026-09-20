export const ULTIMATE_VIDEOGAME_ID = 1386;

export interface TournamentSummary {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
  isOnline: boolean;
  startAt: number;
  endAt: number | null;
  events: EventSummary[];
}

export interface EventSummary {
  id: string;
  name: string;
  entrantCount: number | null;
}

export interface SetParticipant {
  gamerTag: string;
  player: {
    id: string;
    gamerTag: string;
  } | null;
}

export interface SetSlot {
  entrant: {
    id: string;
    name: string;
    participants: SetParticipant[];
  } | null;
}

export interface StartggSet {
  id: string;
  state: number;
  winnerId: string | number | null;
  completedAt: number | null;
  displayScore: string | null;
  slots: SetSlot[];
}

export interface ImportedPlayer {
  id: string;
  gamerTag: string;
}

export interface ImportedSet {
  id: string;
  eventId: string;
  winner: ImportedPlayer;
  loser: ImportedPlayer;
  completedAt: Date;
  rawPayload: Record<string, unknown>;
}

export interface ImportedEvent extends EventSummary {
  sets: ImportedSet[];
}

export interface ImportedTournament extends Omit<TournamentSummary, 'events'> {
  completedAt: Date;
  events: ImportedEvent[];
}

export interface TournamentPage {
  tournaments: TournamentSummary[];
  totalPages: number;
}

export type PlayerTournamentPage = TournamentPage;

export interface SetPage {
  sets: StartggSet[];
  totalPages: number;
}
