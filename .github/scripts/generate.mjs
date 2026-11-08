import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const dataRoot = path.join(root, 'data');
const outputRoot = path.join(root, 'actions-output');
const mode = process.env.MODE || 'long-form';
const apiKey = crypto.randomBytes(32).toString('hex');
const port = '3456';
const baseUrl = `http://127.0.0.1:${port}`;
const headers = { 'content-type': 'application/json', 'x-api-key': apiKey };

async function fetchWithTimeout(url, options, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      fetch(url, options),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs} ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fail(message) {
  throw new Error(message);
}

async function request(route, { method = 'GET', body } = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }, 30000);
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { error: text.slice(0, 500) };
  }
  if (!response.ok) fail(`${method} ${route} failed (${response.status}): ${result.error || text}`);
  return result;
}

async function waitForServer(child, readLog) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`AgentTube exited during startup. Recent log: ${readLog()}`);
    try {
      const response = await fetchWithTimeout(`${baseUrl}/health`, {}, 3000);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  fail(`AgentTube did not become ready in 90 seconds. Recent log: ${readLog()}`);
}

async function waitForJob(jobId, child, readLog) {
  const deadline = Date.now() + 170 * 60 * 1000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`AgentTube stopped while generating. Recent log: ${readLog()}`);
    const job = await request(`/api/jobs/${encodeURIComponent(jobId)}`);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      if (job.status !== 'completed') fail(`Generation ${job.status}: ${job.error || 'no further details'}`);
      return job;
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  fail('Generation exceeded the 170-minute limit. The job will be marked interrupted and can be retried from Actions.');
}

async function copyReferencedFiles(value, destination, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) await copyReferencedFiles(item, destination, seen);
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && /(?:^path$|Path$)/.test(key)) {
      const source = path.resolve(item);
      const relative = path.relative(dataRoot, source);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative) && !seen.has(source)) {
        try {
          const stat = await fs.stat(source);
          if (stat.isFile() && stat.size > 0) {
            const target = path.join(destination, relative);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(source, target);
            seen.add(source);
          }
        } catch {
          // A missing optional asset should not prevent the other drafts from being saved.
        }
      }
    } else if (item && typeof item === 'object') {
      await copyReferencedFiles(item, destination, seen);
    }
  }
}

async function saveProduction(productionId, summary) {
  const bundle = await request(`/api/content/${encodeURIComponent(productionId)}`);
  const folder = path.join(outputRoot, productionId);
  await fs.mkdir(folder, { recursive: true });
  await copyReferencedFiles(bundle, folder);
  await fs.writeFile(path.join(folder, 'summary.json'), JSON.stringify(summary, null, 2));
  return bundle;
}

async function renderShorts(productionId) {
  const proposed = await request(`/api/content/${encodeURIComponent(productionId)}/shorts/propose`, {
    method: 'POST',
    body: { count: 3 }
  });
  const clips = proposed.result;
  if (!Array.isArray(clips) || clips.length === 0) fail('AgentTube did not propose any Shorts for this production.');

  const results = [];
  for (const clip of clips) {
    if (!clip.id) fail('AgentTube returned a Short without an ID.');
    const rendered = await request(
      `/api/content/${encodeURIComponent(productionId)}/shorts/${encodeURIComponent(clip.id)}/render`,
      { method: 'POST', body: {} }
    );
    results.push(rendered.result);
  }
  return results;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) fail('Add GEMINI_API_KEY under Settings → Secrets and variables → Actions before running this workflow.');
  if (!['long-form', 'shorts'].includes(mode)) fail('Choose either long-form or shorts.');

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });

  const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: port,
      HOST: '127.0.0.1',
      API_KEY: apiKey,
      AGENTTUBE_GENERATION_ONLY: 'true',
      DEFAULT_PRIVACY_STATUS: 'private',
      MAX_CONCURRENT_JOBS: '1',
      ANONYMOUS_TELEMETRY_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let recentLog = '';
  const capture = chunk => {
    recentLog = (recentLog + chunk.toString()).slice(-6000);
    process.stdout.write(chunk);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  try {
    await waitForServer(child, () => recentLog);
    if (mode === 'long-form') {
      const topic = String(process.env.TOPIC || '').trim() ||
        'Practical artificial intelligence and digital tools for learners and professionals aged 16 and older';
      if (topic.length > 200) fail('Topic must be 200 characters or fewer.');
      const length = ['short', 'medium', 'long'].includes(process.env.VIDEO_LENGTH)
        ? process.env.VIDEO_LENGTH
        : 'medium';
      const queued = await request('/generate', {
        method: 'POST',
        body: { topic, style: 'tutorial', length }
      });
      const jobId = queued.result?.id || queued.result?.jobId;
      if (!jobId) fail('AgentTube accepted the request but did not return a generation job ID.');
      const job = await waitForJob(jobId, child, () => recentLog);
      const productionId = job.productionId || job.production_id;
      if (!productionId) fail('The generation completed without a production ID.');
      await saveProduction(productionId, {
        type: 'long-form',
        productionId,
        title: job.title || topic,
        status: job.status,
        generatedAt: new Date().toISOString()
      });
      console.log(`Long-form draft ready for review. Production ID: ${productionId}`);

      const createShorts = process.env.GITHUB_EVENT_NAME === 'schedule' || process.env.CREATE_SHORTS === 'true';
      if (createShorts) {
        try {
          const shorts = await renderShorts(productionId);
          await saveProduction(productionId, {
            type: 'long-form-and-shorts',
            productionId,
            title: job.title || topic,
            status: job.status,
            shortCount: shorts.length,
            generatedAt: new Date().toISOString()
          });
          const shortFolder = path.join(outputRoot, productionId, 'shorts');
          await fs.mkdir(shortFolder, { recursive: true });
          await copyReferencedFiles(shorts, shortFolder);
          await fs.writeFile(path.join(shortFolder, 'summary.json'), JSON.stringify(shorts.map(clip => ({
            id: clip.id,
            title: clip.title,
            status: clip.status
          })), null, 2));
          console.log(`Rendered ${shorts.length} Shorts from the new long-form draft.`);
        } catch (error) {
          console.error(`The long-form draft is ready, but Shorts rendering did not finish: ${error.message}`);
        }
      }
    } else {
      const productionId = String(process.env.PRODUCTION_ID || '').trim();
      if (!productionId) fail('Enter the production ID of an existing long-form video to create Shorts.');
      const shorts = await renderShorts(productionId);
      const folder = path.join(outputRoot, productionId, 'shorts');
      await fs.mkdir(folder, { recursive: true });
      await copyReferencedFiles(shorts, folder);
      await fs.writeFile(path.join(folder, 'summary.json'), JSON.stringify(shorts.map(clip => ({
        id: clip.id,
        title: clip.title,
        status: clip.status
      })), null, 2));
      console.log(`Rendered ${shorts.length} Shorts from production ${productionId}.`);
    }
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
