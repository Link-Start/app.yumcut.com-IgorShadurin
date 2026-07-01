import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type LockPackage = {
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type PackageLock = {
  packages: Record<string, LockPackage>;
};

function isExactSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function lockPathForDependency(packagePath: string, dependencyName: string): string {
  return `${packagePath}/node_modules/${dependencyName}`;
}

describe('package-lock optional platform dependencies', () => {
  it('keeps exact wasm Rolldown dependencies resolvable for npm ci on Linux', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as PackageLock;
    const packagePath = 'node_modules/@rolldown/binding-wasm32-wasi';
    const wasmBinding = lock.packages[packagePath];

    expect(wasmBinding).toBeTruthy();
    const dependencies = {
      ...(wasmBinding.dependencies ?? {}),
      ...(wasmBinding.optionalDependencies ?? {}),
    };

    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (!isExactSemver(version)) continue;

      const topLevel = lock.packages[`node_modules/${dependencyName}`];
      const nested = lock.packages[lockPathForDependency(packagePath, dependencyName)];
      const resolved = nested ?? topLevel;

      expect(resolved?.version, `${dependencyName}@${version} is missing from package-lock.json`).toBe(version);
    }
  });
});
