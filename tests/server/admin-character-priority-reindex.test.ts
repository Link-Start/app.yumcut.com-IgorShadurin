import { describe, expect, it } from 'vitest';
import { buildCharacterPriorityReindexPlan } from '@/server/admin/characters';

describe('buildCharacterPriorityReindexPlan', () => {
  it('promotes listed slugs to top and reindexes with step 10', () => {
    const orderedCharacterIds = ['id-a', 'id-b', 'id-c', 'id-d', 'id-x', 'id-z', 'id-v'];
    const slugByCharacterId: Record<string, string> = {
      'id-a': 'a',
      'id-b': 'b',
      'id-c': 'c',
      'id-d': 'd',
      'id-x': 'x',
      'id-z': 'z',
      'id-v': 'v',
    };

    const plan = buildCharacterPriorityReindexPlan({
      orderedCharacterIds,
      slugByCharacterId,
      prioritizedSlugs: ['z', 'b', 'x', 'd', 'v'],
      step: 10,
    });

    expect(plan.finalHighToLowCharacterIds).toEqual(['id-z', 'id-b', 'id-x', 'id-d', 'id-v', 'id-a', 'id-c']);
    expect(plan.priorityByCharacterId['id-c']).toBe(10);
    expect(plan.priorityByCharacterId['id-a']).toBe(20);
    expect(plan.priorityByCharacterId['id-v']).toBe(30);
    expect(plan.priorityByCharacterId['id-d']).toBe(40);
    expect(plan.priorityByCharacterId['id-x']).toBe(50);
    expect(plan.priorityByCharacterId['id-b']).toBe(60);
    expect(plan.priorityByCharacterId['id-z']).toBe(70);
  });

  it('deduplicates prioritized slugs and reports missing ones', () => {
    const plan = buildCharacterPriorityReindexPlan({
      orderedCharacterIds: ['id-a', 'id-b', 'id-c'],
      slugByCharacterId: {
        'id-a': 'a',
        'id-b': 'b',
        'id-c': 'c',
      },
      prioritizedSlugs: ['b', 'B', 'missing', 'b', 'a'],
      step: 10,
    });

    expect(plan.existingPrioritizedSlugs).toEqual(['b', 'a']);
    expect(plan.missingPrioritizedSlugs).toEqual(['missing']);
    expect(plan.finalHighToLowCharacterIds).toEqual(['id-b', 'id-a', 'id-c']);
  });

  it('keeps all priorities unique with +10 step on massive data', () => {
    const size = 5000;
    const orderedCharacterIds = Array.from({ length: size }).map((_, i) => `id-${i + 1}`);
    const slugByCharacterId: Record<string, string> = {};
    for (let i = 0; i < size; i += 1) {
      slugByCharacterId[`id-${i + 1}`] = `slug-${i + 1}`;
    }

    const prioritizedSlugs = [
      'slug-4999',
      'slug-2300',
      'missing-one',
      'slug-2',
      'slug-4100',
      'slug-4999',
      'missing-two',
      'slug-777',
    ];

    const plan = buildCharacterPriorityReindexPlan({
      orderedCharacterIds,
      slugByCharacterId,
      prioritizedSlugs,
      step: 10,
    });

    expect(plan.existingPrioritizedSlugs).toEqual(['slug-4999', 'slug-2300', 'slug-2', 'slug-4100', 'slug-777']);
    expect(plan.missingPrioritizedSlugs).toEqual(['missing-one', 'missing-two']);

    const finalIds = plan.finalHighToLowCharacterIds;
    expect(finalIds).toHaveLength(size);
    expect(new Set(finalIds).size).toBe(size);

    const priorities = finalIds.map((id) => plan.priorityByCharacterId[id]);
    expect(priorities[0]).toBe(size * 10);
    expect(priorities[priorities.length - 1]).toBe(10);

    for (let i = 0; i < priorities.length - 1; i += 1) {
      expect(priorities[i] - priorities[i + 1]).toBe(10);
    }
  });
});
