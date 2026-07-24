import { isBlocked, safeRelPath, safeProj } from '../security.js';
import { jsonResponse, writeCorsHeaders } from '../helpers.js';
import { LIMITS } from '../config.js';

export async function getSearch(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });
  
  const url = new URL(request.url);
  const { searchParams } = url;
  const query = searchParams.get('q') || '';
  if (!query) return jsonResponse({ error: 'Missing ?q= parameter' }, 400, corsHeaders);
  
  const useRegex = searchParams.get('regex') === '1';
  const maxMatches = parseInt(searchParams.get('max') || '50');
  const pathFilter = searchParams.get('path') ? safeRelPath(searchParams.get('path')) : null;

  let matcher;
  if (useRegex) {
    if (query.length > 50) return jsonResponse({ error: 'Regex pattern too long (max 50 chars)' }, 400, corsHeaders);
    try { matcher = new RegExp(query, 'i'); }
    catch (e) { return jsonResponse({ error: 'Invalid regex: ' + e.message }, 400, corsHeaders); }
  }

  const prefix = `projects/${USER}/${proj}/`;
  let listResult = await env.FILES.list({ prefix });
  let allObjects = [...listResult.objects];
  while (listResult.truncated) {
    listResult = await env.FILES.list({ prefix, cursor: listResult.cursor });
    allObjects.push(...listResult.objects);
  }

  let searchable = allObjects.filter(obj => {
    const relPath = obj.key.replace(prefix, '');
    if (!relPath || isBlocked(relPath)) return false;
    if (obj.size > LIMITS.SEARCH_MAX_FILE_SIZE) return false;
    if (pathFilter) {
      const cleanFilter = pathFilter.replace(/\/$/, '');
      const p = cleanFilter + '/';
      if (!relPath.startsWith(p) && relPath !== cleanFilter) return false;
    }
    return true;
  });

  const MAX_SEARCH_FILES = 100;
  const truncated = searchable.length > MAX_SEARCH_FILES;
  if (truncated) searchable = searchable.slice(0, MAX_SEARCH_FILES);

  const matches = [];
  const SEARCH_CONCURRENCY = 8;
  for (let i = 0; i < searchable.length; i += SEARCH_CONCURRENCY) {
    if (matches.length >= maxMatches) break;
    const batch = searchable.slice(i, i + SEARCH_CONCURRENCY);
    await Promise.all(batch.map(async (obj) => {
      if (matches.length >= maxMatches) return;
      const relPath = obj.key.replace(prefix, '');
      try {
        const object = await env.FILES.get(obj.key);
        if (!object) return;
        const text = await object.text();
        const lines = text.split('\n');
        for (let j = 0; j < lines.length; j++) {
          if (matches.length >= maxMatches) break;
          const line = lines[j];
          const isMatch = useRegex ? matcher.test(line) : line.toLowerCase().includes(query.toLowerCase());
          if (isMatch) {
            matches.push({
              path: relPath,
              line: j + 1,
              snippet: line.length > 200 ? line.substring(0, 200) + '…' : line
            });
          }
        }
      } catch (e) {
        console.error('search failed for file', relPath, e);
      }
    }));
  }

  return jsonResponse({ query, matches, count: matches.length, truncated }, 200, corsHeaders);
}
