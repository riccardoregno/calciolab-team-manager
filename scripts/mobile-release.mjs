import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const [action, platform, format = 'aab'] = process.argv.slice(2);
if (!['sync', 'release'].includes(action) || (platform && !['android', 'ios'].includes(platform)) || (action === 'release' && !platform) || !['aab', 'apk'].includes(format)) {
  console.error('Uso: npm run cap:sync oppure npm run release:android[:apk] / release:ios');
  process.exit(1);
}
if (action === 'release' && platform === 'ios' && process.platform !== 'darwin') {
  console.error('La compilazione iOS richiede macOS con Xcode. Su Windows puoi usare npm run deploy:ios per aggiornare il progetto.');
  process.exit(1);
}
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Comando non riuscito (${result.status ?? result.signal}): ${path.basename(command)}`);
}
function normalizeIosPaths() {
  // Capacitor on Windows emits backslashes, which are invalid Swift string escapes.
  const file = path.join(root, 'ios/App/CapApp-SPM/Package.swift');
  const source = readFileSync(file, 'utf8');
  const normalized = source.replace(/path: "([^"]+)"/g, (_, value) => `path: "${value.replaceAll('\\', '/')}"`);
  if (normalized !== source) writeFileSync(file, normalized);
}
try {
  if (action === 'release') {
    if (!process.env.npm_execpath) throw new Error('Avvia la release tramite npm run.');
    run(process.execPath, [process.env.npm_execpath, 'run', 'build:mobile']);
  }
  try {
    run(process.execPath, [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', ...(platform ? [platform] : [])]);
  } finally {
    if (!platform || platform === 'ios') normalizeIosPaths();
  }
  if (action === 'release' && platform === 'android') {
    const task = format === 'apk' ? ':app:assembleRelease' : ':app:bundleRelease';
    const cwd = path.join(root, 'android');
    if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `gradlew.bat ${task} --console=plain`], cwd);
    else run('./gradlew', [task, '--console=plain'], cwd);
  }
  if (action === 'release' && platform === 'ios') {
    run('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Release', '-archivePath', 'ios/App/CalcioLab.xcarchive', 'archive']);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
