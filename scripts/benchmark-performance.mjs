// Run after npm run build. Timings are local microbenchmarks, not device FPS predictions.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { createOpponent } from '../src/systems/OpponentPlanner.js';
import { getAdjacentTargets, getStarTargets } from '../src/utils/itemStars.js';
import { getFootprintCells } from '../src/utils/rotation.js';
import { formatNumber } from '../src/utils/formatNumber.js';

const items = Array.from({ length: 32 }, (_, i) => ({ id: `item${i}`, catalogId: 'sword',
  x: i % 8, y: Math.floor(i / 8), width: 1, height: 1 }));
function sample(name, run, count = 5) {
  const times = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    run(i);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { name, medianMs: times[Math.floor(count / 2)], samples: times };
}
const results = [
  sample('geometry-10000', () => {
    for (let i = 0; i < 10000; i++) {
      getFootprintCells({ width: 4, height: 4 });
      getAdjacentTargets(items[i % 32], items);
      getStarTargets(items[i % 32], items);
    }
  }),
  sample('opponents-round-11-cold', i => createOpponent(11, i)),
  sample('locale-10000', () => { for (let i = 0; i < 10000; i++) formatNumber(i / 3); }),
];
const bundle = fs.readdirSync('dist/assets').filter(name => name.endsWith('.js')).map(name => {
  const bytes = fs.readFileSync(`dist/assets/${name}`);
  return { name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
});
const report = { runtime: `Node ${process.version}`, results, bundle };
fs.writeFileSync('reports/performance-after.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
