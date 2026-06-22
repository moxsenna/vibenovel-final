import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';

const devVarsPath = join(process.cwd(), '.dev.vars');
const content = readFileSync(devVarsPath, 'utf8');
const env = { ...process.env };
content.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^"|"$/g, '');
    env[key] = val;
  }
});

console.log("Loaded ENV keys from .dev.vars:", Object.keys(env).filter(k => k.startsWith("SUPABASE_") || k.includes("AI_")));

const child = spawn('npx', ['tsx', 'src/node-server.ts'], {
  env,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code);
});
