// public/parts의 WebP 목록으로 src/parts/manifest.ts를 만든다.
//   node scripts/gen-manifest.mjs          → 생성
//   node scripts/gen-manifest.mjs --check  → 파일이 최신이 아니면 실패 (build에서 실행)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'public/parts');
const outFile = join(root, 'src/parts/manifest.ts');

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    if (!entry.name.endsWith('.webp')) {
      console.warn(`[gen-manifest] WebP가 아니라 건너뜀: ${relative(root, path)}`);
      return [];
    }
    // 경로 키는 OS와 상관없이 '/'로 구분한다. 예: 'hair-back/bob/pink'
    return [
      relative(partsDir, path)
        .split(sep)
        .join('/')
        .replace(/\.webp$/, ''),
    ];
  });
}

const keys = collect(partsDir).sort();
const content = `// 자동 생성 파일입니다. 손으로 고치지 말고 \`pnpm gen:manifest\`로 다시 만드세요.
// public/parts/<key>.webp 로 번들된 기본 파츠의 경로 키 목록.

export const BUNDLED_PARTS: ReadonlySet<string> = new Set([
${keys.map((key) => `  '${key}',`).join('\n')}
]);
`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {
    // 파일이 없으면 최신이 아닌 것으로 본다
  }
  if (current !== content) {
    console.error(
      '[gen-manifest] src/parts/manifest.ts가 public/parts와 다릅니다. `pnpm gen:manifest`를 실행하세요.',
    );
    process.exit(1);
  }
} else {
  writeFileSync(outFile, content);
  console.log(`[gen-manifest] ${keys.length}개 파츠 → ${relative(root, outFile)}`);
}
