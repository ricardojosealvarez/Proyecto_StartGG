export const SMASH_GAMES = [
  { id: 1386, slug: 'game/ultimate', label: 'Ultimate' },
  { id: 1, slug: 'game/melee', label: 'Melee' },
  { id: 5, slug: 'game/brawl', label: 'Brawl' },
  { id: 3, slug: 'game/super-smash-bros-for-wii-u', label: 'Wii U' },
  { id: 4, slug: 'game/super-smash-bros', label: '64' },
] as const;

export const DEFAULT_SMASH_GAME_ID = SMASH_GAMES[0].id;

export function getSmashGameLabel(gameId: number) {
  return SMASH_GAMES.find((game) => game.id === gameId)?.label ?? 'Smash';
}
