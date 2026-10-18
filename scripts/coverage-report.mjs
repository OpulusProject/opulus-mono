#!/usr/bin/env node
/**
 * What the tests ran of one service's own source, from the V8 coverage that Node
 * wrote while they ran (NODE_V8_COVERAGE).
 *
 *   node scripts/coverage-report.mjs <coverage dir> <source dir> <report dir>
 *   node scripts/coverage-report.mjs coverage/webhooks opulus-webhooks/src coverage/webhooks-report
 *
 * Each process writes a file of its own, and the processes do not run the same
 * code: the services run through tsx, the tests through Playwright's own
 * transform, so the same source file reaches V8 as different scripts and c8
 * cannot add them together. This reports each process's file separately (c8,
 * mapped back to the TypeScript), then adds up, per source line, the lines that
 * ran in any of them. Lines are those c8 counts for the source dir with nothing
 * run (`--all`), so a file nothing loaded is all uncovered.
 *
 * Prints the totals and, for each file, the lines that did not run; writes
 * lcov.info to the report dir.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [coverageDir, sourceDir, reportDir] = process.argv.slice(2);
if (!coverageDir || !sourceDir || !reportDir) {
  console.error("Usage: coverage-report.mjs <coverage dir> <source dir> <report dir>");
  process.exit(2);
}

const c8 = (tempDir, outDir, extra = []) =>
  execFileSync(
    "pnpm",
    [
      "exec", "c8", "report",
      "--temp-directory", tempDir,
      "--report-dir", outDir,
      "--reporter", "lcovonly",
      "--src", sourceDir,
      "--include", `${sourceDir}/**`,
      "--exclude-after-remap",
      "--exclude", "**/node_modules/**",
      "--exclude", "**/*.d.ts",
      ...extra,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

/** { file: Map<line, hits> } from an lcov file. */
function readLcov(file) {
  const files = new Map();
  let current;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("SF:")) files.set((current = line.slice(3)), new Map());
    else if (line.startsWith("DA:") && current) {
      const [n, hits] = line.slice(3).split(",");
      files.get(current).set(Number(n), Number(hits));
    }
  }
  return files;
}

const work = mkdtempSync(path.join(os.tmpdir(), "coverage-report-"));
try {
  // Every executable line of the source, with nothing run.
  const empty = path.join(work, "empty");
  mkdirSync(empty);
  c8(empty, path.join(work, "baseline"), ["--all"]);
  const total = readLcov(path.join(work, "baseline", "lcov.info"));

  // What each process ran, one at a time.
  const processes = readdirSync(coverageDir).filter((name) => name.endsWith(".json"));
  processes.forEach((name, i) => {
    const one = path.join(work, `p${i}`);
    mkdirSync(one);
    copyFileSync(path.join(coverageDir, name), path.join(one, name));
    try {
      c8(one, path.join(work, `r${i}`));
    } catch {
      return; // a process that loaded none of this source
    }
    for (const [file, lines] of readLcov(path.join(work, `r${i}`, "lcov.info"))) {
      const sum = total.get(file);
      if (!sum) continue;
      for (const [line, hits] of lines) if (sum.has(line)) sum.set(line, sum.get(line) + hits);
    }
  });

  let ran = 0;
  let all = 0;
  const gaps = [];
  for (const [file, lines] of [...total].sort(([a], [b]) => a.localeCompare(b))) {
    const missed = [...lines].filter(([, hits]) => hits === 0).map(([line]) => line).sort((a, b) => a - b);
    all += lines.size;
    ran += lines.size - missed.length;
    if (missed.length) gaps.push(`${file}  ${missed.length} not run: ${compact(missed)}`);
  }

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, "lcov.info"),
    [...total]
      .map(([file, lines]) => `SF:${file}\n${[...lines].map(([n, h]) => `DA:${n},${h}`).join("\n")}\nLF:${lines.size}\nLH:${[...lines].filter(([, h]) => h > 0).length}\nend_of_record`)
      .join("\n") + "\n",
  );

  console.log(`${sourceDir}: ${ran}/${all} lines ran = ${((100 * ran) / all).toFixed(1)}%  (${processes.length} processes recorded)`);
  console.log(gaps.length ? gaps.join("\n") : "Every line ran.");
} finally {
  rmSync(work, { recursive: true, force: true });
}

/** [1,2,3,7,8] as "1-3,7-8". */
function compact(numbers) {
  const parts = [];
  for (let i = 0; i < numbers.length; i++) {
    let j = i;
    while (numbers[j + 1] === numbers[j] + 1) j++;
    parts.push(i === j ? `${numbers[i]}` : `${numbers[i]}-${numbers[j]}`);
    i = j;
  }
  return parts.join(",");
}
