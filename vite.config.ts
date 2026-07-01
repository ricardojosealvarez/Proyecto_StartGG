import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const USER_PROFILE_URL_PATTERN = /^https:\/\/www\.start\.gg\/(user\/[^/?#&]+)/i;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const BROWSER_LIKE_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://duckduckgo.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
const playerSearchCache = new Map<string, { expiresAt: number; slugs: string[] }>();

function normalizeStartggUserSlug(url: string) {
  const match = url.match(USER_PROFILE_URL_PATTERN);
  return match?.[1] ?? null;
}

function extractStartggUserSlugs(html: string) {
  const matches = [...html.matchAll(/uddg=([^"&]+)/g)];
  const seenSlugs = new Set<string>();
  const slugs: string[] = [];

  for (const match of matches) {
    const decodedUrl = decodeURIComponent(match[1] ?? '');
    const slug = normalizeStartggUserSlug(decodedUrl);

    if (!slug || seenSlugs.has(slug)) {
      continue;
    }

    seenSlugs.add(slug);
    slugs.push(slug);
  }

  return slugs;
}

async function searchDuckDuckGoProfiles(query: string) {
  const searchTerms = [`site:start.gg/user ${query} smash`, `site:start.gg/user ${query}`];
  const seenSlugs = new Set<string>();
  const slugs: string[] = [];

  const cachedEntry = playerSearchCache.get(query);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.slugs;
  }

  for (const searchTerm of searchTerms) {
    const searchUrls = [
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchTerm)}&kl=us-en`,
      `https://duckduckgo.com/html/?q=${encodeURIComponent(searchTerm)}&kl=us-en`,
    ];

    for (const searchUrl of searchUrls) {
      const response = await fetch(searchUrl, {
        headers: BROWSER_LIKE_HEADERS,
      });

      if (response.status === 403) {
        continue;
      }

      if (!response.ok) {
        throw new Error(`DuckDuckGo respondió con ${response.status}.`);
      }

      const html = await response.text();

      for (const slug of extractStartggUserSlugs(html)) {
        if (seenSlugs.has(slug)) {
          continue;
        }

        seenSlugs.add(slug);
        slugs.push(slug);
      }

      if (slugs.length > 0) {
        break;
      }
    }

    if (slugs.length > 0) {
      break;
    }
  }

  playerSearchCache.set(query, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    slugs,
  });

  return slugs;
}

function playerSearchProxy(): Plugin {
  const handler = async (req: { method?: string; url?: string }, res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
  }, next: () => void) => {
    if (!req.url?.startsWith('/api/player-search')) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const query = requestUrl.searchParams.get('q')?.trim() ?? '';

    res.setHeader('Content-Type', 'application/json');

    if (query.length < 2) {
      res.end(JSON.stringify({ query, candidates: [] }));
      return;
    }

    try {
      const candidates = searchDuckDuckGoProfiles(query)
        .then((slugs) => slugs
        .slice(0, 6)
        .map((slug) => ({
          slug,
          url: `https://www.start.gg/${slug}`,
        })));

      res.end(JSON.stringify({ query, candidates: await candidates }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pude buscar perfiles de Start.gg por nombre.';

      res.statusCode = 502;
      res.end(
        JSON.stringify({
          error:
            message === 'DuckDuckGo respondió con 403.'
              ? 'El proveedor externo de búsqueda ha bloqueado temporalmente la consulta. Prueba de nuevo en unos segundos o usa un nombre más específico.'
              : message,
        })
      );
    }
  };

  return {
    name: 'startgg-player-search-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), playerSearchProxy()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
