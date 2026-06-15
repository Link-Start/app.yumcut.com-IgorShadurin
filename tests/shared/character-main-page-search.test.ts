import { describe, expect, it } from 'vitest';
import {
  filterMainPageGroupsForSearch,
  findMainPageMatchingCharacters,
  mainPageStoriesMatchesSearch,
  normalizeMainPageSearchQuery,
  normalizeMainPageTopLevelMode,
  resolveMainPageLandingView,
  resolveInitialMainPageTopLevelMode,
  type MainPageGroup,
} from '@/components/character/main-page-groups';

function character(input: {
  id: string;
  slug: string;
  name: string;
  bio?: string;
  hiddenSearchText?: string;
}) {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    bio: input.bio ?? '',
    hiddenSearchText: { en: input.hiddenSearchText ?? '', ru: input.hiddenSearchText ?? '' },
    imageUrl: `/characters/${input.slug}.webp`,
    creationsCount: 0,
    favoritesCount: 0,
    isFavorited: false,
  };
}

const groups: MainPageGroup[] = [
  {
    id: 'cats',
    title: { en: 'Cat Characters', ru: 'Коты' },
    subtitle: { en: 'Whiskers and paws', ru: '' },
    description: { en: 'Funny cat cast', ru: '' },
    hiddenSearchText: { en: 'feline', ru: '' },
    characters: [
      character({ id: 'cat-1', slug: 'milo-cat', name: 'Milo Cat', bio: 'Sleeps a lot' }),
    ],
  },
  {
    id: 'dogs',
    title: { en: 'Dog Characters', ru: 'Собаки' },
    subtitle: { en: 'Barks and walks', ru: '' },
    description: { en: 'Funny dog cast', ru: '' },
    hiddenSearchText: { en: 'canine', ru: '' },
    characters: [
      character({ id: 'dog-1', slug: 'buddy-dog', name: 'Buddy Dog', bio: 'Loves parks' }),
      character({ id: 'dog-2', slug: 'hidden-pup', name: 'Rex', bio: 'Quiet', hiddenSearchText: 'golden puppy' }),
    ],
  },
];

describe('character main page search', () => {
  it('keeps expanded category view when search is empty', () => {
    expect(resolveMainPageLandingView({
      isSearchActive: false,
      hasExpandedGroup: true,
      hasSingleGroup: false,
    })).toBe('expanded');
  });

  it('shows global search view even when a category is expanded', () => {
    expect(resolveMainPageLandingView({
      isSearchActive: true,
      hasExpandedGroup: true,
      hasSingleGroup: false,
    })).toBe('search');
  });

  it('normalizes top-level landing modes', () => {
    expect(normalizeMainPageTopLevelMode('stories')).toBe('stories');
    expect(normalizeMainPageTopLevelMode('brainrot')).toBe('brainrot');
    expect(normalizeMainPageTopLevelMode('cats')).toBeNull();
  });

  it('infers brainrot mode for legacy openCategory links', () => {
    expect(resolveInitialMainPageTopLevelMode({
      openMode: undefined,
      hasOpenCategory: true,
    })).toBe('brainrot');
    expect(resolveInitialMainPageTopLevelMode({
      openMode: 'stories',
      hasOpenCategory: true,
    })).toBe('stories');
  });

  it('matches story searches against the top-level Stories category', () => {
    expect(mainPageStoriesMatchesSearch(normalizeMainPageSearchQuery('old story'), 'en')).toBe(true);
    expect(mainPageStoriesMatchesSearch(normalizeMainPageSearchQuery('сценарий'), 'ru')).toBe(true);
    expect(mainPageStoriesMatchesSearch(normalizeMainPageSearchQuery('canine'), 'en')).toBe(false);
  });

  it('finds matching characters outside the currently expanded category', () => {
    const normalizedSearch = normalizeMainPageSearchQuery(' puppy ');
    const rows = findMainPageMatchingCharacters(groups, normalizedSearch, 'en');

    expect(rows.map((row) => row.character.slug)).toEqual(['hidden-pup']);
    expect(rows[0]?.groupId).toBe('dogs');
  });

  it('returns matching categories for category or character matches', () => {
    expect(filterMainPageGroupsForSearch(groups, normalizeMainPageSearchQuery('feline'), 'en').map((group) => group.id))
      .toEqual(['cats']);
    expect(filterMainPageGroupsForSearch(groups, normalizeMainPageSearchQuery('buddy'), 'en').map((group) => group.id))
      .toEqual(['dogs']);
  });
});
