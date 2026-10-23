// Manual synthetic-only benchmark. Never pass real users, repositories or tickets.
import { runBenchmark } from '../src/benchmark.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !['--dry-run', '--live'].includes(args[0]))) {
  console.error('Usage: node scripts/benchmark.mjs [--dry-run|--live]');
  process.exitCode = 2;
} else {
  const live = args[0] === '--live';
  const result = await runBenchmark({
    live,
    authorization: process.env.JEV_BENCHMARK_AUTH,
    maxCalls: Number(process.env.JEV_BENCHMARK_MAX_CALLS || 0),
    apiKey: process.env.TYPESAFE_API_KEY,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || '1',
    onRecord: (record) => console.log(JSON.stringify({ kind: 'jev_benchmark_trial', ...record })),
  });
  const { results, plan, ...summary } = result;
  console.log(JSON.stringify({ kind: 'jev_benchmark_summary', ...summary }));
  // A completed benchmark with poor scores is evidence, not a system error.
  if (live && result.status !== 'complete') process.exitCode = 1;
}
