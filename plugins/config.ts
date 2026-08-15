
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
// Similar to engine.ts this acts as a facade of our config.json and the engine. This is so the XTASK binary actually knows where to look and resolve locations.

export type ConfigFile = {
  gameDir?: string | null;
  patchDir?: string | null;
  exportDir?: string | null;
  engineDir?: string;
};

export type Config = {
  gameDir: string | null;
  patchDir: string;
  exportDir: string;
  engineDir: string | null;
  haveEngine: boolean;
  xtask: { command: string; args: string[] };
  source: string | null;
};

export const CONFIG_FILE = 'config.json';

const DEFAULT_PATCH_DIR = 'launch/patched';
const DEFAULT_EXPORT_DIR = 'data/reference/generated/spell-export';
const CARGO_XTASK = { command: 'cargo', args: ['run', '-q', '-p', 'xtask', '--'] };
export const SHIPPED_XTASK = 'bin/xtask.exe';

export class ConfigError extends Error {}

export function resolveConfig(
  file: ConfigFile,
  root: string,
  source: string | null,
  exists: (p: string) => boolean = existsSync,
): Config {
  const resolve = (p: string) => (path.isAbsolute(p) ? p : path.resolve(root, p));

  const mustExist = (value: string | undefined | null, field: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    const full = resolve(value);
    if (!exists(full)) {
      throw new ConfigError(
        `${CONFIG_FILE}: ${field} is set to "${value}", which resolves to ${full} and does ` +
          `not exist. Fix the path, or remove the setting to let the engine search for it.`,
      );
    }
    return full;
  };

  const engineDir = file.engineDir === undefined ? null : resolve(file.engineDir);
  const haveEngine = engineDir !== null;
  if (engineDir !== null && !exists(engineDir)) {
    throw new ConfigError(
      `${CONFIG_FILE}: engineDir is set to "${file.engineDir}", which resolves to ` +
        `${engineDir} and does not exist. Remove it to use the shipped bin/xtask.exe.`,
    );
  }

  const gameDir = mustExist(file.gameDir, 'gameDir');
  if (gameDir && !exists(path.join(gameDir, 'regulation.bin'))) {
    throw new ConfigError(
      `${CONFIG_FILE}: gameDir "${file.gameDir}" has no regulation.bin beside it. Point it ` +
        `at Elden Ring's "Game" folder, not the install root.`,
    );
  }

  const shipped = path.join(root, SHIPPED_XTASK);
  let xtask: { command: string; args: string[] };
  if (haveEngine) {
    xtask = CARGO_XTASK;
  } else if (exists(shipped)) {
    xtask = { command: shipped, args: [] };
  } else {
    throw new ConfigError(
      `${SHIPPED_XTASK} is missing, so there is no engine to run. Re-clone or re-download ` +
        `the release — or, if you are working on the engine itself, set engineDir in ` +
        `${CONFIG_FILE} to a source checkout (that path needs a Rust toolchain).`,
    );
  }

  return {
    gameDir,
    patchDir: resolve(file.patchDir ?? DEFAULT_PATCH_DIR),
    exportDir: resolve(file.exportDir ?? DEFAULT_EXPORT_DIR),
    engineDir,
    haveEngine,
    xtask,
    source,
  };
}

export function configEnv(config: Config, base = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  const set = (name: string, value: string | null) => {
    if (value !== null) env[name] = value;
  };

  set('SSC_GAME_DIR', config.gameDir);
  set('SSC_PATCH_DIR', config.patchDir);
  set('SSC_EXPORT_DIR', config.exportDir);
  return env;
}

export function loadConfig(root = process.cwd()): Config {
  const configPath = path.join(root, CONFIG_FILE);
  let file: ConfigFile = {};

  if (existsSync(configPath)) {
    try {
      file = JSON.parse(readFileSync(configPath, 'utf8')) as ConfigFile;
    } catch (e) {
      throw new ConfigError(
        `${CONFIG_FILE} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (process.env.SSC_ENGINE_DIR) file.engineDir = process.env.SSC_ENGINE_DIR;

  return resolveConfig(file, root, existsSync(configPath) ? configPath : null);
}

export function describeConfig(config: Config): string {
  const lines = [
    config.source ? `  config      ${config.source}` : `  config      (none, using defaults)`,
    `  xtask       ${[config.xtask.command, ...config.xtask.args].join(' ')}`,
    `  game        ${config.gameDir ?? '(engine searches a standard Steam install)'}`,
    `  patch       ${config.patchDir}${existsSync(config.patchDir) ? '' : '  (not seeded — run `xtask init`)'}`,
    `  export      ${config.exportDir}${existsSync(config.exportDir) ? '' : '  (no export yet)'}`,
  ];
  if (config.engineDir) lines.push(`  engine      ${config.engineDir}  (building from source)`);
  return lines.join('\n');
}
