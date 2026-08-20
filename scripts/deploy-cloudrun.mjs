import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

loadDotenv({ path: path.join(projectRoot, '.env.local') });
loadDotenv({ path: path.join(projectRoot, '.env') });

const region = process.env.CLOUD_RUN_REGION?.trim() || 'europe-west1';
const service = process.env.CLOUD_RUN_SERVICE?.trim() || 'portfolio';

const buildEnvEntries = Object.entries(process.env).filter(
  ([key, value]) => key.startsWith('PUBLIC_') && typeof value === 'string' && value.trim() !== '',
);

const args = [
  'run',
  'deploy',
  service,
  '--source',
  '.',
  '--region',
  region,
  '--allow-unauthenticated',
];

if (buildEnvEntries.length > 0) {
  const buildEnvVars = buildEnvEntries.map(([key, value]) => `${key}=${value}`).join(',');
  args.push(`--set-build-env-vars=${buildEnvVars}`);
  console.log(`Build env: ${buildEnvEntries.map(([key]) => key).join(', ')}`);
} else {
  console.warn(
    'No PUBLIC_* variables found in .env/.env.local. Client-side config may be empty in production.',
  );
}

console.log(`Deploying ${service} to ${region}...`);
console.log(
  'Server secrets: Cloud Run → Variables & secrets. PUBLIC_*: normal env vars in Cloud Run.',
);

const result = spawnSync('gcloud', args, {
  cwd: projectRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
