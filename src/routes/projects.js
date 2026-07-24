import { listProjectFiles } from '../storage.js';
import { isBlocked, safeRelPath, safeProj } from '../security.js';
import { jsonResponse, guessContentType, buildStructuredTree, writeCorsHeaders, checkAuth } from '../helpers.js';

export async function getHealth(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  return jsonResponse({ status: 'ok', user: USER, timestamp: Date.now() }, 200, corsHeaders);
}

export async function getConfig(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  return jsonResponse({ apiBase: "", user: USER }, 200, corsHeaders);
}

export async function getProjects(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  const { results } = await env.DB.prepare(
    'SELECT proj, updated_at, files_count, commits_count FROM projects WHERE user = ? ORDER BY updated_at DESC'
  ).bind(USER).all();

  const list = results.map(row => ({
    name: row.proj,
    updatedAt: row.updated_at,
    filesCount: row.files_count,
    commitsCount: row.commits_count
  }));

  return jsonResponse(list, 200, corsHeaders);
}

export async function getTip(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });
  
  const last = await env.DB.prepare(
    "SELECT hash12, created_at FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1"
  ).bind(USER, proj).first();
  return jsonResponse({ commit: last?.hash12 || null, created_at: last?.created_at || null }, 200, corsHeaders);
}

export async function getTree(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

  const url = new URL(request.url);
  const { searchParams } = url;
  const wantMeta = searchParams.get('meta') === '1' || searchParams.get('meta') === 'true';
  const wantFlat = searchParams.get('flat') === '1' || searchParams.get('flat') === 'true';

  const lastCommit = await env.DB.prepare(
    "SELECT hash12, created_at FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1"
  ).bind(USER, proj).first();

  const commitHash = lastCommit?.hash12 || 'none';
  const etag = `"${commitHash}-${wantMeta ? 'meta' : wantFlat ? 'flat' : 'tree'}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ...corsHeaders, 'ETag': etag } });
  }

  // listProjectFiles returns objects: { path, size, sha256, lines }[]
  const files = await listProjectFiles(env.FILES, USER, proj);
  const paths = files.map(f => f.path);

  if (wantFlat) {
    return jsonResponse(paths, 200, corsHeaders, { 'ETag': etag });
  }

  if (wantMeta) {
    const fileList = files.map(f => ({
      path: f.path,
      size: f.size,
      sha256: f.sha256
    }));
    return jsonResponse({
      repo: `${USER}/${proj}`,
      project: proj,
      commit: commitHash,
      createdAt: lastCommit?.created_at || null,
      files: fileList,
      count: fileList.length
    }, 200, corsHeaders, { 'ETag': etag });
  }

  const { tree } = buildStructuredTree(paths, Object.fromEntries(files.map(f => [f.path, f.size])));
  return jsonResponse({
    repo: `${USER}/${proj}`,
    project: proj,
    commit: commitHash,
    createdAt: lastCommit?.created_at || null,
    files: paths,
    tree,
    count: paths.length
  }, 200, corsHeaders, { 'ETag': etag });
}

export async function getFile(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });
  
  const url = new URL(request.url);
  const filePath = safeRelPath(url.searchParams.get('path') || '');
  if (!filePath || isBlocked(filePath)) return new Response('Invalid path', { status: 400, headers: corsHeaders });
  
  const object = await env.FILES.get(`projects/${USER}/${proj}/${filePath}`);
  if (!object) return new Response('Not Found', { status: 404, headers: corsHeaders });
  
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', guessContentType(filePath));
  // Caching Phase 3.1
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  
  return new Response(object.body, { headers });
}

export async function getHistory(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

  const { results: commits } = await env.DB.prepare(
    "SELECT id, hash12, author, message, stats_json, created_at FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 50"
  ).bind(USER, proj).all();

  const history = commits.map(c => ({
    id: c.id,
    hash: c.hash12,
    author: c.author,
    message: c.message,
    stats: JSON.parse(c.stats_json),
    date: new Date(c.created_at).toISOString(),
  }));

  return jsonResponse(history, 200, corsHeaders);
}

export async function postReset(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  
  if (!env.TINYHUB_TOKEN || !checkAuth(request, env)) {
    return new Response('Unauthorized: Token not configured or invalid', { status: 401, headers: corsHeaders });
  }
  
  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

  const files = await listProjectFiles(env.FILES, USER, proj);
  if (files.length > 0) {
    const keys = files.map(f => `projects/${USER}/${proj}/${f.path}`);
    for (let i = 0; i < keys.length; i += 1000) {
      await env.FILES.delete(keys.slice(i, i + 1000));
    }
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM commit_files WHERE commit_id IN (SELECT id FROM commits WHERE user = ? AND proj = ?)').bind(USER, proj),
    env.DB.prepare('DELETE FROM commits WHERE user = ? AND proj = ?').bind(USER, proj),
    env.DB.prepare('DELETE FROM projects WHERE user = ? AND proj = ?').bind(USER, proj)
  ]);

  return jsonResponse({ ok: true, message: 'Project reset completed' }, 200, corsHeaders);
}
