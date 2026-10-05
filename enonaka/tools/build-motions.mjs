// えのなか の内蔵のうごきを作る。
//   node enonaka/tools/build-motions.mjs <Text-To-VRMA のフォルダ>
//
// motions/specs/*.json は Text-To-VRMA の「LLM キーフレーム」方式のモーション spec（骨ごとのオイラー角キーフレーム）。
// それを Text-To-VRMA 本体の validateSpec（可動域の検査とクランプ）→ softenMotion（全身のなめらか補正）→ buildVRMA（VRMA 書き出し）
// に通して、motions/<id>.vrma と motions/index.json を作る。Text-To-VRMA のフォルダでは先に `npm install` しておく（three が要る）。
//   Text-To-VRMA: https://github.com/Kirakun0328/text-to-vrma（MIT、© Kiratchi）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', 'motions');
const t2v = resolve(process.argv[2] || process.env.TEXT_TO_VRMA || '');
const load = p => import(pathToFileURL(join(t2v, 'src', p)).href);
const { validateSpec } = await load('llm.js');
const { softenMotion } = await load('smoothMotion.js');
const { buildVRMA } = await load('vrmaBuilder.js');

const files = readdirSync(join(root, 'specs')).filter(f => f.endsWith('.json'));
const entries = [];
for (const f of files) {
  const src = JSON.parse(readFileSync(join(root, 'specs', f), 'utf8'));
  const id = f.replace(/\.json$/, '');
  const spec = structuredClone(src.spec);
  validateSpec(spec);
  if (!spec.hips?.length) delete spec.hips;
  // validateSpec が角度を丸めたら知らせる（書いた値が可動域の外だった）
  const clamped = [];
  for (const [bone, keys] of Object.entries(src.spec.tracks)) {
    const out = spec.tracks[bone];
    if (!out) { clamped.push(bone + '（削除）'); continue; }
    keys.forEach((k, i) => { if (out[i] && k.r.some((v, j) => Math.abs(v - out[i].r[j]) > 1e-6)) clamped.push(`${bone}@${k.t}`); });
  }
  const soft = softenMotion(spec);
  const buf = Buffer.from(buildVRMA(soft));
  writeFileSync(join(root, id + '.vrma'), buf);
  entries.push({ order: src.order ?? 99, id, name: src.name, emoji: src.emoji, file: id + '.vrma', loop: !!spec.loop, wander: src.wander !== false, duration: spec.duration, prompt: src.prompt });
  console.log(`${id.padEnd(10)} ${spec.duration.toFixed(1)}s ${String(buf.length).padStart(7)} B${clamped.length ? '  丸めた: ' + clamped.join(', ') : ''}`);
}
entries.sort((a, b) => a.order - b.order);
writeFileSync(join(root, 'index.json'), JSON.stringify(entries.map(({ order, ...e }) => e), null, 1) + '\n');
console.log(`${entries.length} 個`);
