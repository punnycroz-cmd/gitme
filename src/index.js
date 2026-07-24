import { Router } from 'itty-router';
import { getHealth, getConfig, getProjects, getTip, getTree, getFile, getHistory, postReset } from './routes/projects.js';
import { getSearch } from './routes/search.js';
import { postUpload } from './routes/upload.js';
import { postCommit } from './routes/commit.js';
import { getRawFile, getBrowser, getDump } from './routes/dump.js';
import { writeCorsHeaders } from './helpers.js';

const router = Router();

// Rate limiting middleware using the Cloudflare Rate Limiting binding
const rateLimitMiddleware = async (request, env) => {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const isWrite = ['POST', 'PUT', 'DELETE'].includes(request.method);
  if (isWrite && env.WRITE_RATE_LIMITER) {
    const { success } = await env.WRITE_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      const corsHeaders = writeCorsHeaders(request);
      return new Response('Too Many Requests', { status: 429, headers: corsHeaders });
    }
  }
};

router.all('*', rateLimitMiddleware);

// Handle CORS preflight requests
router.options('*', (request) => {
  return new Response(null, { status: 204, headers: writeCorsHeaders(request) });
});

// Define router endpoints
router.get('/api/health', getHealth);
router.get('/api/config', getConfig);
router.get('/api/projects', getProjects);
router.get('/api/tip/:proj', getTip);
router.get('/api/tree/:proj', getTree);
router.get('/api/file/:proj', getFile);
router.get('/api/history/:proj', getHistory);
router.post('/api/reset/:proj', postReset);

router.get('/api/search/:proj', getSearch);
router.post('/api/upload/:proj', postUpload);
router.post('/api/commit/:proj', postCommit);

router.get('/r/:user/:proj/*', getRawFile);
router.get('/p/:user/:proj/*', getBrowser);
router.get('/p/:user/:proj', getBrowser); // Also match without trailing slash
router.get('/dump/:user/:proj', getDump);
router.get('/dump/:user/:proj/', getDump);

// Fallback to static asset serving or 404
router.all('*', async (request, env) => {
  const corsHeaders = writeCorsHeaders(request);
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.ok) {
    const headers = new Headers(assetRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return new Response(assetRes.body, { status: assetRes.status, headers });
  }
  return new Response('Not Found', { status: 404, headers: corsHeaders });
});

export default {
  async fetch(request, env, ctx) {
    try {
      return await router.fetch(request, env, ctx);
    } catch (err) {
      console.error(err);
      const corsHeaders = writeCorsHeaders(request);
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
  },
  async scheduled(event, env, ctx) {
    const tenMinsAgo = Date.now() - 10 * 60_000;
    
    // Find all failed/pending commits older than 10 minutes
    const failedCommits = await env.DB.prepare(
      "SELECT id, user, proj FROM commits WHERE (status = 'failed' OR status = 'pending') AND created_at < ?"
    ).bind(tenMinsAgo).all();
    
    if (failedCommits?.results?.length > 0) {
      for (const commit of failedCommits.results) {
        // Find added files in this commit
        const addedFiles = await env.DB.prepare(
          "SELECT path FROM commit_files WHERE commit_id = ? AND change_type = 'added'"
        ).bind(commit.id).all();
        
        if (addedFiles?.results?.length > 0) {
          const keys = addedFiles.results.map(f => `projects/${commit.user}/${commit.proj}/${f.path}`);
          // Delete from R2
          for (let i = 0; i < keys.length; i += 1000) {
            await env.FILES.delete(keys.slice(i, i + 1000));
          }
        }
        
        // Delete from D1 (cascade will delete commit_files)
        await env.DB.prepare("DELETE FROM commits WHERE id = ?").bind(commit.id).run();
      }
    }
  }
};
