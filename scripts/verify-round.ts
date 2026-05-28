#!/usr/bin/env bun

import {
  commitServerSecret,
  deriveCrashOutcome,
  MICRO_UNIT,
  verifyCrashOutcome,
} from "../services/games/src/domain/services/provably-fair.ts";

type VerifyApiResponse = {
  roundId: string;
  commitHash: string;
  serverSecret: string | null;
  clientSeed: string;
  nonce: string;
  crashMultiplier: string | null;
  runDurationMs: number | null;
  verified: boolean;
};

type VerifyInput = {
  serverSecret: string;
  commitHash: string;
  clientSeed: string;
  nonce: string;
  crashMultiplierMicro?: bigint;
  crashMultiplierDisplay?: string;
  runDurationMs: number;
};

const DEFAULT_API = "http://localhost:8000";

function usage(): never {
  console.error(`Usage:
  bun scripts/verify-round.ts [--api URL] <roundId>

  bun scripts/verify-round.ts \\
    --server-secret <hex> \\
    --commit-hash <sha256hex> \\
    --client-seed <string> \\
    --nonce <string> \\
    --crash-multiplier <display e.g. 2.45> \\
    --crash-multiplier-micro <exact micro-units, optional instead of display> \\
    --run-duration-ms <number>

Options:
  --api URL              Kong / games API base (default: ${DEFAULT_API})
  --help                 Show this message`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  apiBase: string;
  roundId?: string;
  manual?: VerifyInput;
} {
  let apiBase = DEFAULT_API;
  let roundId: string | undefined;
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage();
    if (arg === "--api") {
      apiBase = argv[++i] ?? "";
      if (!apiBase) usage();
      continue;
    }
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = argv[++i] ?? "";
      continue;
    }
    if (!roundId) {
      roundId = arg;
      continue;
    }
    usage();
  }

  if (flags["server-secret"]) {
    for (const key of ["commit-hash", "client-seed", "nonce", "run-duration-ms"] as const) {
      if (!flags[key]) {
        console.error(`Manual mode: missing --${key}`);
        usage();
      }
    }
    if (!flags["crash-multiplier"] && !flags["crash-multiplier-micro"]) {
      console.error("Manual mode: provide --crash-multiplier or --crash-multiplier-micro");
      usage();
    }
    const manual: VerifyInput = {
      serverSecret: flags["server-secret"],
      commitHash: flags["commit-hash"],
      clientSeed: flags["client-seed"],
      nonce: flags.nonce,
      runDurationMs: Number.parseInt(flags["run-duration-ms"], 10),
    };
    if (flags["crash-multiplier-micro"]) {
      manual.crashMultiplierMicro = BigInt(flags["crash-multiplier-micro"]);
    } else {
      manual.crashMultiplierDisplay = flags["crash-multiplier"];
    }
    return { apiBase, manual };
  }

  if (!roundId) usage();
  return { apiBase, roundId };
}

function formatMultiplierMicro(micro: bigint): string {
  const whole = micro / MICRO_UNIT;
  const hundredths = (micro % MICRO_UNIT) / 10_000n;
  return `${whole}.${hundredths.toString().padStart(2, "0")}`;
}

async function fetchVerify(apiBase: string, roundId: string): Promise<VerifyApiResponse> {
  const url = `${apiBase.replace(/\/$/, "")}/games/rounds/${roundId}/verify`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${url} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as VerifyApiResponse;
}

function verifyRound(input: VerifyInput, label: string): boolean {
  const derived = deriveCrashOutcome(input.serverSecret, input.clientSeed, input.nonce);
  const commitOk = commitServerSecret(input.serverSecret) === input.commitHash;
  const durationOk = derived.runDurationMs === input.runDurationMs;

  let crashOk: boolean;
  if (input.crashMultiplierMicro !== undefined) {
    crashOk = derived.crashMultiplierMicro === input.crashMultiplierMicro;
  } else if (input.crashMultiplierDisplay !== undefined) {
    crashOk =
      formatMultiplierMicro(derived.crashMultiplierMicro) === input.crashMultiplierDisplay;
  } else {
    crashOk = false;
  }

  const ok =
    input.crashMultiplierMicro !== undefined
      ? verifyCrashOutcome({
          serverSecret: input.serverSecret,
          commitHash: input.commitHash,
          clientSeed: input.clientSeed,
          nonce: input.nonce,
          crashMultiplierMicro: input.crashMultiplierMicro,
          runDurationMs: input.runDurationMs,
        })
      : commitOk && durationOk && crashOk;

  const claimedDisplay =
    input.crashMultiplierDisplay ??
    (input.crashMultiplierMicro !== undefined
      ? formatMultiplierMicro(input.crashMultiplierMicro)
      : "?");

  console.log(`\n=== Provably fair verification: ${label} ===\n`);
  console.log(`commitHash:       ${input.commitHash}`);
  console.log(`commit matches:   ${commitOk ? "yes" : "NO"}`);
  console.log(`clientSeed:       ${input.clientSeed}`);
  console.log(`nonce:            ${input.nonce}`);
  console.log(`crash (claimed):  ${claimedDisplay}x`);
  console.log(
    `crash (derived):  ${formatMultiplierMicro(derived.crashMultiplierMicro)}x (${derived.crashMultiplierMicro} micro)`,
  );
  console.log(`runDurationMs:    claimed=${input.runDurationMs} derived=${derived.runDurationMs}`);
  console.log(`\nverified:         ${ok ? "PASS" : "FAIL"}\n`);

  return ok;
}

async function main(): Promise<void> {
  const { apiBase, roundId, manual } = parseArgs(process.argv.slice(2));

  if (manual) {
    const ok = verifyRound(manual, "manual input");
    process.exit(ok ? 0 : 1);
  }

  const data = await fetchVerify(apiBase, roundId!);

  if (!data.serverSecret) {
    console.error(
      `Round ${roundId} has not revealed serverSecret yet (phase not SETTLED?).\n` +
        `commitHash: ${data.commitHash}\n` +
        `clientSeed: ${data.clientSeed}\n` +
        `nonce:      ${data.nonce}`,
    );
    process.exit(2);
  }

  if (!data.crashMultiplier || data.runDurationMs === null) {
    console.error(`Round ${roundId} is missing crash outcome fields.`);
    process.exit(2);
  }

  const input: VerifyInput = {
    serverSecret: data.serverSecret,
    commitHash: data.commitHash,
    clientSeed: data.clientSeed,
    nonce: data.nonce,
    crashMultiplierDisplay: data.crashMultiplier,
    runDurationMs: data.runDurationMs,
  };

  const ok = verifyRound(input, roundId!);
  if (data.verified !== ok) {
    console.warn(
      `Warning: API reported verified=${data.verified} but local check is ${ok ? "PASS" : "FAIL"}.`,
    );
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
