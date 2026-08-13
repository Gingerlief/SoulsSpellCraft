
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import { configEnv, describeConfig, loadConfig, type Config } from './config.js';

type Res = Parameters<Connect.NextHandleFunction>[1];

function json(res: Res, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(text);
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

type Run = { code: number; stdout: string; stderr: string; output: string };

function runXtask(config: Config, args: string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn(config.xtask.command, [...config.xtask.args, ...args], {
      // `cargo run` has to start inside the engine checkout; the shipped exe does not care.
      cwd: config.engineDir ?? process.cwd(),
      shell: process.platform === 'win32',
      env: configEnv(config),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) =>
      resolve({ code: -1, stdout, stderr, output: `${stdout}${stderr}\n${e.message}` }),
    );
    child.on('close', (code) =>
      resolve({ code: code ?? -1, stdout, stderr, output: stdout + stderr }),
    );
  });
}

async function applyDocument(
  config: Config,
  body: string,
  subcommand: 'spell' | 'craft',
  id: unknown,
): Promise<Run> {
  const patchPath = path.join(tmpdir(), `${subcommand}-${id ?? 'unknown'}.json`);
  await writeFile(patchPath, body, 'utf8');
  // A craft edits the working copy in place once it has been seeded; without one there is
  // nothing to edit, so the engine writes a fresh file instead.
  const seeded = existsSync(path.join(config.patchDir, 'regulation.bin'));
  const mode = subcommand === 'craft' && seeded ? '--in-place' : '--force';
  return runXtask(config, [subcommand, 'apply', patchPath, mode]);
}

function parseSlots(stdout: string): number[] {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+$/.test(l))
    .map(Number);
}

function statusFor(run: Run): number {
  if (run.code === 0) return 200;
  const stale = /re-export|authored against|base moved|schemaVersion/i.test(run.output);
  return stale ? 409 : 500;
}

export function enginePlugin(): Plugin {
  return {
    name: 'engine-bridge',
    configureServer(server) {
      const config = loadConfig();
      server.config.logger.info(`\n engine bridge\n${describeConfig(config)}\n`);

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();

        try {
          if (req.method === 'GET' && url === '/api/index') {
            if (!existsSync(path.join(config.exportDir, 'index.json'))) {
              return json(res, 404, {
                error: 'no export found',
                detail:
                  `No index.json in ${config.exportDir}. Seed the working copy from your ` +
                  `game install, then export:\n` +
                  `    bin/xtask.exe init\n` +
                  `    bin/xtask.exe spell export --all`,
                exportDir: config.exportDir,
              });
            }
            const text = await readFile(path.join(config.exportDir, 'index.json'), 'utf8');
            res.setHeader('content-type', 'application/json');
            return res.end(text);
          }

          const spell = /^\/api\/spell\/(\d+)$/.exec(url);
          if (req.method === 'GET' && spell) {
            // Digits only, enforced by the pattern above — the id becomes a filename, so
            // anything else would be a path traversal waiting to happen.
            const file = path.join(config.exportDir, `${spell[1]}.json`);
            if (!existsSync(file)) {
              return json(res, 404, { error: `no exported document for spell ${spell[1]}` });
            }
            res.setHeader('content-type', 'application/json');
            return res.end(await readFile(file, 'utf8'));
          }

          if (req.method === 'POST' && url === '/api/apply') {
            const body = await readBody(req);
            let magicId: unknown;
            try {
              magicId = (JSON.parse(body) as { magicId?: unknown }).magicId;
            } catch {
              return json(res, 400, { error: 'patch is not valid JSON' });
            }
            const run = await applyDocument(config, body, 'spell', magicId);
            return json(res, statusFor(run), { ok: run.code === 0, output: run.output.trim() });
          }

          if (req.method === 'POST' && url === '/api/fxr/repack') {
            const run = await runXtask(config, ['fxr', 'repack']);
            if (run.code !== 0) {
              return json(res, 500, { ok: false, output: run.output.trim() });
            }
            let detail: unknown = null;
            try {
              detail = JSON.parse(run.stdout.trim());
            } catch {
              // The JSON line is a convenience; WitchyBND's own noise is the useful part
              // when something went wrong, and it is already in `output`.
            }
            return json(res, 200, { ok: true, output: run.stderr.trim(), detail });
          }

          const bytesMatch = /^\/api\/fxr\/(\d+)\/bytes$/.exec(url);
          if (bytesMatch) {
            const id = Number(bytesMatch[1]);
            const run = await runXtask(config, ['fxr', 'where', String(id)]);
            if (run.code !== 0) {
              return json(res, 500, { error: `could not locate sfx ${id}`, detail: run.output.trim() });
            }
            let where: { path: string | null; writeDir: string | null; fileName: string };
            try {
              where = JSON.parse(run.stdout.trim());
            } catch {
              return json(res, 500, { error: 'engine did not answer with JSON' });
            }

            if (req.method === 'GET') {
              if (!where.path) return json(res, 404, { error: `no file for sfx ${id}` });
              const bytes = await readFile(where.path);
              res.statusCode = 200;
              res.setHeader('content-type', 'application/octet-stream');
              return res.end(bytes);
            }

            if (req.method === 'POST') {
              if (!where.writeDir) {
                return json(res, 500, {
                  error: 'no effect directory to write into',
                  detail: 'Unpack the sfx binders, or set SFX_DIRS. See locate.rs.',
                });
              }
              if (where.path) {
                return json(res, 409, {
                  error: `sfx ${id} already exists`,
                  detail:
                    `${where.path}\nEffects are shared, so replacing one edits every spell ` +
                    `that reaches it. Pick an unused id.`,
                });
              }
              const chunks: Buffer[] = [];
              for await (const c of req) chunks.push(c as Buffer);
              const target = path.join(where.writeDir, where.fileName);
              await writeFile(target, Buffer.concat(chunks));
              return json(res, 200, { id, path: target, bytes: Buffer.concat(chunks).length });
            }
          }

          const fxrMatch = /^\/api\/fxr\/(\d+)$/.exec(url);
          if (req.method === 'GET' && fxrMatch) {
            const run = await runXtask(config, ['fxr', 'where', fxrMatch[1]]);
            if (run.code !== 0) {
              return json(res, 500, {
                error: `could not locate sfx ${fxrMatch[1]}`,
                detail: run.output.trim(),
              });
            }
            try {
              return json(res, 200, JSON.parse(run.stdout.trim()));
            } catch {
              return json(res, 500, {
                error: 'engine did not answer with JSON',
                detail: run.output.trim(),
              });
            }
          }

          if (req.method === 'GET' && url === '/api/dummies') {
            const run = await runXtask(config, ['craft', 'list-dummies']);
            if (run.code !== 0) {
              return json(res, 500, { error: 'could not list slots', detail: run.output.trim() });
            }
            return json(res, 200, { slots: parseSlots(run.stdout), detail: run.stderr.trim() });
          }

          if (req.method === 'POST' && url === '/api/dummies') {
            const created = await runXtask(config, [
              'craft',
              'new-dummy',
              '--count',
              '1',
              '--apply',
            ]);
            if (created.code !== 0) {
              return json(res, 500, { ok: false, output: created.output.trim() });
            }

            const reexport = await runXtask(config, ['spell', 'export', '--all']);

            const listed = await runXtask(config, ['craft', 'list-dummies']);

            return json(res, 200, {
              ok: true,
              slots: listed.code === 0 ? parseSlots(listed.stdout) : [],
              output: created.output.trim(),
              reexported: reexport.code === 0,
              reexportOutput: reexport.code === 0 ? undefined : reexport.output.trim(),
            });
          }

          if (req.method === 'POST' && url === '/api/craft') {
            const body = await readBody(req);
            let targetId: unknown;
            try {
              targetId = (JSON.parse(body) as { targetId?: unknown }).targetId;
            } catch {
              return json(res, 400, { error: 'craft patch is not valid JSON' });
            }
            const run = await applyDocument(config, body, 'craft', targetId);
            if (run.code !== 0) {
              return json(res, statusFor(run), { ok: false, output: run.output.trim() });
            }

            const reexport = await runXtask(config, ['spell', 'export', '--all']);
            return json(res, 200, {
              ok: true,
              output: run.output.trim(),
              reexported: reexport.code === 0,
              reexportOutput: reexport.code === 0 ? undefined : reexport.output.trim(),
            });
          }

          return json(res, 404, { error: `no such endpoint: ${url}` });
        } catch (e) {
          return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
