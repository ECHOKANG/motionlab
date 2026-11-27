import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { configureToolEnvironment } from './tool-environment.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
let persistDirectory = path.join(projectRoot, '.wrangler/state');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--persist-to' && args[i + 1]) persistDirectory = path.resolve(process.cwd(), args[++i]);
  else { console.error('Usage: npm run db:migrate:local -- [--persist-to <directory>]'); process.exit(1); }
}
const builtConfigPath = path.join(projectRoot, 'dist/server/wrangler.json');
if (!existsSync(builtConfigPath)) {
  console.error('缺少构建配置，请先运行 npm run build，再运行 npm run db:migrate:local。');
  process.exit(1);
}
const builtDirectory = path.dirname(builtConfigPath);
const config = JSON.parse(readFileSync(builtConfigPath, 'utf8'));
if (!config.d1_databases?.some(database => database.binding === 'DB')) {
  console.error('构建配置中没有 DB 绑定，请检查 .openai/hosting.json 的 d1 设置并重新构建。');
  process.exit(1);
}
// Moving the generated config must not change the meaning of its relative paths.
if (config.main) config.main = path.resolve(builtDirectory, config.main);
if (config.assets?.directory) config.assets.directory = path.resolve(builtDirectory, config.assets.directory);
if (config.build?.watch_dir) config.build.watch_dir = Array.isArray(config.build.watch_dir)
  ? config.build.watch_dir.map(directory => path.resolve(builtDirectory, directory))
  : path.resolve(builtDirectory, config.build.watch_dir);
config.d1_databases = config.d1_databases.map(database => database.binding === 'DB'
  ? { ...database, migrations_dir: path.join(projectRoot, 'drizzle') }
  : database);
const runtimeDirectory = path.join(projectRoot, '.sites-runtime/migrations');
mkdirSync(runtimeDirectory, { recursive: true });
const localConfigPath = path.join(runtimeDirectory, 'wrangler.json');
writeFileSync(localConfigPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
configureToolEnvironment(projectRoot);
const result = spawnSync(process.execPath, [
  '--import', path.join(projectRoot, 'scripts/sites-env.mjs'),
  path.join(projectRoot, 'node_modules/wrangler/bin/wrangler.js'),
  'd1', 'migrations', 'apply', 'DB', '--local',
  '--config', localConfigPath, '--persist-to', persistDirectory,
], { cwd: projectRoot, env: process.env, stdio: 'inherit' });
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
