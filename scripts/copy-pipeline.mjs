// Copies the CI/CD workflow into public/ so the Security page can render the real YAML.
// Runs automatically before `npm run build` (npm "prebuild" hook).
import { mkdirSync, copyFileSync } from 'node:fs';

const src = '.github/workflows/ci-cd.yml';
const destDir = 'public/pipeline';
mkdirSync(destDir, { recursive: true });
// .txt extension so it is served as text/plain and never executed or rendered.
copyFileSync(src, `${destDir}/ci-cd.yml.txt`);
console.log(`Copied ${src} -> ${destDir}/ci-cd.yml.txt`);
