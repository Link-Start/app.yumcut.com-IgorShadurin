#!/usr/bin/env node
import {
  formatExternalToolsDoctorReport,
  hasBlockingExternalToolIssues,
  runExternalToolsDoctor,
} from './helpers/external-tools-doctor';

async function main() {
  const args = new Set(process.argv.slice(2));
  const envFileArg = process.argv.find((arg) => arg.startsWith('--env-file='));
  const report = await runExternalToolsDoctor({
    envFile: envFileArg ? envFileArg.slice('--env-file='.length) : undefined,
    network: !args.has('--no-network') && process.env.DAEMON_DOCTOR_SKIP_NETWORK !== '1',
  });

  if (args.has('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatExternalToolsDoctorReport(report));
  }

  if (args.has('--strict') && hasBlockingExternalToolIssues(report)) {
    process.exitCode = 1;
  }
}

void main().catch((err: any) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
