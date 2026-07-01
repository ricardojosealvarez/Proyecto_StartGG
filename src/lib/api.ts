import { GraphQLClient } from 'graphql-request';

const API_ENDPOINT = 'https://api.start.gg/gql/alpha';
const API_KEY = import.meta.env.VITE_STARTGG_API_KEY;

export const client = new GraphQLClient(API_ENDPOINT, {
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
});

export const searchPlayerQuery = `
  query SearchPlayers($query: String!) {
    players(query: $query, first: 8) {
      nodes {
        id
        gamerTag
        user {
          id
          images {
            url
          }
        }
        rankings {
          rank
          title
        }
      }
    }
  }
`;

export const getPlayerStatsQuery = `
  query PlayerStats($playerId: ID!) {
    player(id: $playerId) {
      gamerTag
      user {
        bio
        images {
          url
        }
      }
      rankings {
        rank
        title
      }
      results(first: 20) {
        nodes {
          placement
          entrant {
            event {
              name
              tournament {
                name
                startAt
              }
            }
          }
        }
      }
    }
  }
`;

export const headToHeadQuery = `
  query HeadToHead($player1Id: ID!, $player2Id: ID!) {
    player1: player(id: $player1Id) {
      gamerTag
      user {
        images {
          url
        }
      }
    }
    player2: player(id: $player2Id) {
      gamerTag
      user {
        images {
          url
        }
      }
    }
    sets(
      filters: {
        playerIds: [$player1Id, $player2Id]
      }
    ) {
      nodes {
        winnerId
        displayScore
        event {
          name
          tournament {
            name
            startAt
          }
        }
      }
    }
  }
`;