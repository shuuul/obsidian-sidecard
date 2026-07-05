#!/usr/bin/env node
import { execFileSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';

const pluginId = 'sidecard';
const openCommand = `${pluginId}:open-card-library`;

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const envContent = readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function getVaultPath() {
  if (process.env.OBSIDIAN_VAULT) return process.env.OBSIDIAN_VAULT;

  const obsidianConfig = path.join(os.homedir(), 'Library/Application Support/obsidian/obsidian.json');
  if (!existsSync(obsidianConfig)) return null;

  const config = JSON.parse(readFileSync(obsidianConfig, 'utf-8'));
  const vaults = Object.values(config.vaults ?? {});
  const openVault = vaults.find((vault) => vault.open) ?? vaults[0];
  return typeof openVault?.path === 'string' ? openVault.path : null;
}

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function runObsidian(args, options = {}) {
  const timeout = options.timeout ?? 30_000;
  const allowFailure = options.allowFailure ?? false;
  const tolerate = options.tolerate ?? [];
  console.log(`$ obsidian ${args.join(' ')}`);

  const result = spawnSync('obsidian', args, {
    encoding: 'utf-8',
    timeout,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output.trim()) process.stdout.write(output);

  const tolerated = tolerate.some((text) => output.includes(text));
  if (result.error || (result.status !== 0 && !tolerated)) {
    if (allowFailure) {
      console.warn(`Warning: obsidian ${args.join(' ')} did not complete cleanly.`);
      return;
    }
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  }
}

loadEnvLocal();
const vaultPath = getVaultPath();

if (!vaultPath || !existsSync(vaultPath)) {
  console.error('Set OBSIDIAN_VAULT in .env.local to your vault path before loading into Obsidian.');
  process.exit(1);
}

if (!process.env.OBSIDIAN_VAULT) {
  process.env.OBSIDIAN_VAULT = vaultPath;
}

const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', pluginId);
console.log(`Using Obsidian vault: ${vaultPath}`);
console.log(`Deploying plugin to: ${pluginDir}`);

run('npm', ['run', 'build'], { env: process.env });

const communityPluginsPath = path.join(vaultPath, '.obsidian', 'community-plugins.json');
let communityPlugins = [];
if (existsSync(communityPluginsPath)) {
  communityPlugins = JSON.parse(readFileSync(communityPluginsPath, 'utf-8'));
}
if (!communityPlugins.includes(pluginId)) {
  communityPlugins.push(pluginId);
  writeFileSync(communityPluginsPath, `${JSON.stringify(communityPlugins, null, 2)}\n`);
  console.log(`Enabled ${pluginId} in community-plugins.json`);
}

runObsidian(['reload'], { timeout: 45_000 });
runObsidian(['plugin:enable', `id=${pluginId}`], {
  tolerate: [`Plugin "${pluginId}" is already enabled.`],
});
runObsidian(['plugin:reload', `id=${pluginId}`], { timeout: 45_000, allowFailure: true });
runObsidian(['command', `id=${openCommand}`], { timeout: 45_000 });
runObsidian(['dev:errors'], { timeout: 20_000 });
