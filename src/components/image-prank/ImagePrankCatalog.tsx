"use client";

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import type {
  ImagePrankCatalogCategoryDTO,
  ImagePrankCatalogItemDTO,
  ImagePrankCatalogSubcategoryDTO,
  LocalizedCatalogTextDTO,
} from '@/shared/types';

const PAGE_SIZE = 18;
const SUBCATEGORY_HOVER_SECTIONS = 5;
const CARD_LABEL_GRADIENT = 'h-36 bg-[linear-gradient(to_top,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.67)_18%,rgba(0,0,0,0.48)_38%,rgba(0,0,0,0.28)_58%,rgba(0,0,0,0.12)_76%,rgba(0,0,0,0.04)_90%,rgba(0,0,0,0)_100%)]';
const IMAGE_PRANK_MODE_PARAM = 'image-prank';
const IMAGE_PRANK_CATEGORY_PARAM = 'category';
const IMAGE_PRANK_SUBCATEGORY_PARAM = 'subcategory';

const COPY: Record<AppLanguageCode, {
  title: string;
  searchPlaceholder: string;
  customTitle: string;
  customSubtitle: string;
  mainBack: string;
  back: string;
  empty: string;
  previous: string;
  next: string;
}> = {
  en: {
    title: 'Image Prank',
    searchPlaceholder: 'Search prank images...',
    customTitle: 'Custom mix',
    customSubtitle: 'Upload your own prank images',
    mainBack: 'Main',
    back: 'Categories',
    empty: 'No prank images yet.',
    previous: 'Previous',
    next: 'Next',
  },
  ru: {
    title: 'Image Prank',
    searchPlaceholder: 'Поиск prank-картинок...',
    customTitle: 'Свой микс',
    customSubtitle: 'Загрузить свои изображения',
    mainBack: 'Главная',
    back: 'Категории',
    empty: 'Prank-картинок пока нет.',
    previous: 'Назад',
    next: 'Вперёд',
  },
};

type Props = {
  categories: ImagePrankCatalogCategoryDTO[];
};

type CatalogSelection = {
  categoryId: string | null;
  subcategoryId: string | null;
};

function pickText(value: LocalizedCatalogTextDTO, language: AppLanguageCode) {
  return language === 'ru' ? value.ru || value.en : value.en || value.ru;
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function itemMatches(item: ImagePrankCatalogItemDTO, query: string, language: AppLanguageCode) {
  if (!query) return true;
  return [
    item.slug,
    pickText(item.title, language),
    pickText(item.description, language),
    pickText(item.hiddenSearchText, language),
    pickText(item.categoryTitle, language),
  ].some((value) => value.toLowerCase().includes(query));
}

function categoryMatches(category: ImagePrankCatalogCategoryDTO, query: string, language: AppLanguageCode) {
  if (!query) return true;
  return [
    category.slug,
    pickText(category.title, language),
    pickText(category.subtitle, language),
    pickText(category.description, language),
    pickText(category.hiddenSearchText, language),
  ].some((value) => value.toLowerCase().includes(query))
    || (category.subcategories ?? []).some((subcategory) => subcategoryMatches(subcategory, query, language))
    || category.items.some((item) => itemMatches(item, query, language));
}

function subcategoryMatches(subcategory: ImagePrankCatalogSubcategoryDTO, query: string, language: AppLanguageCode) {
  if (!query) return true;
  return [
    subcategory.slug,
    pickText(subcategory.title, language),
    pickText(subcategory.subtitle, language),
    pickText(subcategory.description, language),
    pickText(subcategory.hiddenSearchText, language),
  ].some((value) => value.toLowerCase().includes(query)) || subcategory.items.some((item) => itemMatches(item, query, language));
}

function findCategoryBySlugOrId(categories: ImagePrankCatalogCategoryDTO[], value: string | null) {
  if (!value) return null;
  return categories.find((category) => category.slug === value || category.id === value) ?? null;
}

function findSubcategoryBySlugOrId(categories: ImagePrankCatalogCategoryDTO[], value: string | null) {
  if (!value) return null;
  for (const category of categories) {
    const subcategory = (category.subcategories ?? []).find((item) => item.slug === value || item.id === value);
    if (subcategory) return { category, subcategory };
  }
  return null;
}

function resolveCatalogSelectionFromSearchParams(
  categories: ImagePrankCatalogCategoryDTO[],
  searchParams: URLSearchParams,
): CatalogSelection {
  const subcategoryMatch = findSubcategoryBySlugOrId(categories, searchParams.get(IMAGE_PRANK_SUBCATEGORY_PARAM));
  if (subcategoryMatch) {
    return {
      categoryId: subcategoryMatch.category.id,
      subcategoryId: subcategoryMatch.subcategory.id,
    };
  }

  const category = findCategoryBySlugOrId(categories, searchParams.get(IMAGE_PRANK_CATEGORY_PARAM));
  return {
    categoryId: category?.id ?? null,
    subcategoryId: null,
  };
}

function buildImagePrankCatalogUrl(input: {
  category?: ImagePrankCatalogCategoryDTO | null;
  subcategory?: ImagePrankCatalogSubcategoryDTO | null;
}) {
  const url = new URL(typeof window === 'undefined' ? 'http://localhost/' : window.location.href);
  url.pathname = '/';
  url.searchParams.set('openMode', IMAGE_PRANK_MODE_PARAM);
  url.searchParams.delete('openCategory');
  url.searchParams.delete('page');

  if (input.category) {
    url.searchParams.set(IMAGE_PRANK_CATEGORY_PARAM, input.category.slug);
  } else {
    url.searchParams.delete(IMAGE_PRANK_CATEGORY_PARAM);
  }

  if (input.subcategory) {
    url.searchParams.set(IMAGE_PRANK_SUBCATEGORY_PARAM, input.subcategory.slug);
  } else {
    url.searchParams.delete(IMAGE_PRANK_SUBCATEGORY_PARAM);
  }

  url.hash = '';
  return `${url.pathname}${url.search}`;
}

function PreviewGrid({ images, label }: { images: string[]; label: string }) {
  const preview = Array.from({ length: 4 }, (_, index) => (
    images.length > 0 ? images[index % images.length] : null
  ));
  return (
    <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-gray-200 dark:bg-gray-800">
      {preview.map((imageUrl, index) => (
        <div key={`${imageUrl ?? 'empty'}-${index}`} className="overflow-hidden bg-gray-100 dark:bg-gray-900">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${label} ${index + 1}`}
              className="h-full w-full origin-top scale-[1.3] object-cover object-top"
              loading="lazy"
            />
          ) : (
            <div className={cn('h-full w-full', index % 2 === 0 ? 'bg-gray-100 dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950')} />
          )}
        </div>
      ))}
    </div>
  );
}

function itemPreviewUrl(item: ImagePrankCatalogItemDTO) {
  return item.previewImageUrl || item.imageUrl;
}

function SubcategoryHoverPreview({ items, label }: { items: ImagePrankCatalogItemDTO[]; label: string }) {
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const previewImages = useMemo(() => (
    items.slice(0, SUBCATEGORY_HOVER_SECTIONS).map(itemPreviewUrl)
  ), [items]);
  const activeIndex = activeSection ?? 0;
  const activeImage = previewImages[activeIndex] ?? previewImages[0] ?? null;

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (previewImages.length <= 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const nextSection = Math.min(
      previewImages.length - 1,
      Math.floor((relativeX / rect.width) * previewImages.length),
    );
    setActiveSection((currentSection) => (currentSection === nextSection ? currentSection : nextSection));
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gray-100 dark:bg-gray-900"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setActiveSection(null)}
      onBlur={() => setActiveSection(null)}
    >
      {activeImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeImage}
          alt={label}
          className="h-full w-full origin-top scale-[1.3] object-cover object-top transition-opacity duration-200"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full bg-gray-100 dark:bg-gray-900" />
      )}
    </div>
  );
}

function CustomCard({ copy }: { copy: (typeof COPY)[AppLanguageCode] }) {
  return (
    <Link href="/image-prank/custom" className="block h-full cursor-pointer focus-visible:outline-none">
      <article className="group relative h-full overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/30 dark:hover:border-blue-800">
        <div className="flex h-full min-h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.3)]">
            <ImagePlus className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-950 dark:text-white">{copy.customTitle}</h3>
            <p className="mt-1 text-xs leading-4 text-blue-900/70 dark:text-blue-100/75">{copy.customSubtitle}</p>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CategoryCard({
  category,
  language,
  onSelect,
}: {
  category: ImagePrankCatalogCategoryDTO;
  language: AppLanguageCode;
  onSelect: () => void;
}) {
  const title = pickText(category.title, language);
  const firstItem = category.items[0] ?? null;
  const previewContent = (
    <div className="relative aspect-[9/16] w-full">
      <PreviewGrid images={category.items.map((item) => item.imageUrl)} label={title} />
      <div className={cn('pointer-events-none absolute inset-x-0 bottom-0', CARD_LABEL_GRADIENT)} />
    </div>
  );
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700">
      {firstItem ? (
        <Link href={`/image-prank/${encodeURIComponent(firstItem.slug)}`} className="block cursor-pointer focus-visible:outline-none">
          {previewContent}
        </Link>
      ) : (
        <button type="button" onClick={onSelect} className="block w-full cursor-pointer focus-visible:outline-none">
          {previewContent}
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        className="block w-full cursor-pointer bg-white px-3 py-3 text-left transition hover:bg-gray-50 focus-visible:outline-none dark:bg-gray-950 dark:hover:bg-gray-900"
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-none text-gray-950 dark:text-white">{title}</h3>
        </div>
      </button>
    </article>
  );
}

function SubcategoryCard({
  subcategory,
  language,
  onSelect,
}: {
  subcategory: ImagePrankCatalogSubcategoryDTO;
  language: AppLanguageCode;
  onSelect: () => void;
}) {
  const title = pickText(subcategory.title, language);
  return (
    <button type="button" onClick={onSelect} className="block w-full cursor-pointer text-left focus-visible:outline-none">
      <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700">
        <div className="relative aspect-[9/16] w-full">
          <SubcategoryHoverPreview items={subcategory.items} label={title} />
          <div className={cn('pointer-events-none absolute inset-x-0 bottom-0', CARD_LABEL_GRADIENT)} />
        </div>
        <div className="bg-white px-3 py-3 dark:bg-gray-950">
          <h3 className="truncate text-sm font-semibold leading-none text-gray-950 dark:text-white">{title}</h3>
        </div>
      </article>
    </button>
  );
}

function ItemCard({ item, language }: { item: ImagePrankCatalogItemDTO; language: AppLanguageCode }) {
  const title = pickText(item.title, language);
  const previewUrl = item.previewImageUrl || item.imageUrl;
  return (
    <Link href={`/image-prank/${encodeURIComponent(item.slug)}`} className="block cursor-pointer focus-visible:outline-none">
      <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700">
        <div className="relative aspect-[9/16] w-full bg-gray-100 dark:bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
          <div className={cn('pointer-events-none absolute inset-x-0 bottom-0', CARD_LABEL_GRADIENT)} />
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 text-white">
            <h3 className="truncate text-sm font-semibold leading-none">{title}</h3>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function ImagePrankCatalog({ categories }: Props) {
  const { language } = useAppLanguage();
  const copy = COPY[language];
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return resolveCatalogSelectionFromSearchParams(categories, new URL(window.location.href).searchParams).categoryId;
  });
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return resolveCatalogSelectionFromSearchParams(categories, new URL(window.location.href).searchParams).subcategoryId;
  });
  const [page, setPage] = useState(1);
  const normalizedQuery = normalizeSearch(query);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedSubcategory = (selectedCategory?.subcategories ?? []).find((subcategory) => subcategory.id === selectedSubcategoryId) ?? null;
  const hasMultipleCategories = categories.length > 1;

  const rootCategories = useMemo(() => (
    hasMultipleCategories
      ? categories.filter((category) => categoryMatches(category, normalizedQuery, language))
      : []
  ), [categories, hasMultipleCategories, language, normalizedQuery]);

  const rootItems = useMemo(() => {
    if (hasMultipleCategories) return [];
    const onlyCategory = categories[0] ?? null;
    return onlyCategory
      ? onlyCategory.items
          .filter((item) => !item.subcategoryId)
          .filter((item) => itemMatches(item, normalizedQuery, language))
      : [];
  }, [categories, hasMultipleCategories, language, normalizedQuery]);
  const rootSubcategories = useMemo(() => {
    if (hasMultipleCategories) return [];
    const onlyCategory = categories[0] ?? null;
    return onlyCategory
      ? (onlyCategory.subcategories ?? []).filter((subcategory) => subcategoryMatches(subcategory, normalizedQuery, language))
      : [];
  }, [categories, hasMultipleCategories, language, normalizedQuery]);

  const categoryItems = useMemo(() => (
    selectedCategory
      ? selectedCategory.items.filter((item) => itemMatches(item, normalizedQuery, language))
      : []
  ), [language, normalizedQuery, selectedCategory]);
  const categorySubcategories = useMemo(() => (
    selectedCategory && !selectedSubcategory
      ? (selectedCategory.subcategories ?? []).filter((subcategory) => subcategoryMatches(subcategory, normalizedQuery, language))
      : []
  ), [language, normalizedQuery, selectedCategory, selectedSubcategory]);
  const directCategoryItems = useMemo(() => (
    selectedCategory && !selectedSubcategory
      ? categoryItems.filter((item) => !item.subcategoryId)
      : []
  ), [categoryItems, selectedCategory, selectedSubcategory]);
  const subcategoryItems = useMemo(() => (
    selectedSubcategory
      ? selectedSubcategory.items.filter((item) => itemMatches(item, normalizedQuery, language))
      : []
  ), [language, normalizedQuery, selectedSubcategory]);

  const entries = selectedCategory
    ? selectedSubcategory
      ? subcategoryItems.map((item) => ({ type: 'item' as const, item }))
      : [
          ...categorySubcategories.map((subcategory) => ({ type: 'subcategory' as const, subcategory })),
          ...directCategoryItems.map((item) => ({ type: 'item' as const, item })),
        ]
    : [
        { type: 'custom' as const },
        ...(hasMultipleCategories
          ? rootCategories.map((category) => ({ type: 'category' as const, category }))
          : [
              ...rootSubcategories.map((subcategory) => ({ type: 'subcategory' as const, subcategory })),
              ...rootItems.map((item) => ({ type: 'item' as const, item })),
            ]),
      ];
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = entries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const applySelectionFromUrl = () => {
    if (typeof window === 'undefined') return;
    const nextSelection = resolveCatalogSelectionFromSearchParams(categories, new URL(window.location.href).searchParams);
    setSelectedCategoryId(nextSelection.categoryId);
    setSelectedSubcategoryId(nextSelection.subcategoryId);
    setPage(1);
  };

  useEffect(() => {
    applySelectionFromUrl();
    const handlePopState = () => applySelectionFromUrl();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const pushCatalogUrl = (url: string) => {
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (url === currentUrl) return;
    window.history.pushState({ imagePrankCatalog: true }, '', url);
  };

  const selectCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId) ?? null;
    if (!category) return;
    pushCatalogUrl(buildImagePrankCatalogUrl({ category }));
    setSelectedCategoryId(category.id);
    setSelectedSubcategoryId(null);
    setPage(1);
  };

  const selectSubcategory = (subcategoryId: string) => {
    const parentCategory = categories.find((category) => (category.subcategories ?? []).some((subcategory) => subcategory.id === subcategoryId)) ?? null;
    const subcategory = (parentCategory?.subcategories ?? []).find((item) => item.id === subcategoryId) ?? null;
    if (!parentCategory || !subcategory) return;
    pushCatalogUrl(buildImagePrankCatalogUrl({ category: parentCategory, subcategory }));
    setSelectedCategoryId(parentCategory.id);
    setSelectedSubcategoryId(subcategory.id);
    setPage(1);
  };

  const resetCatalog = () => {
    setSelectedCategoryId(null);
    setSelectedSubcategoryId(null);
    setPage(1);
    pushCatalogUrl(buildImagePrankCatalogUrl({}));
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-14">
      <div className="flex min-h-10 items-center gap-2">
        {selectedCategory ? (
          <button
            type="button"
            onClick={resetCatalog}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm transition hover:border-blue-300 hover:text-blue-800 dark:border-blue-800/80 dark:bg-gray-950/70 dark:text-blue-300 dark:hover:border-blue-700 dark:hover:text-blue-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{copy.mainBack}</span>
          </button>
        ) : (
          <Link
            href="/"
            className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm transition hover:border-blue-300 hover:text-blue-800 dark:border-blue-800/80 dark:bg-gray-950/70 dark:text-blue-300 dark:hover:border-blue-700 dark:hover:text-blue-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{copy.mainBack}</span>
          </Link>
        )}
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={copy.searchPlaceholder}
            className="h-10 rounded-full pl-9"
            aria-label={copy.searchPlaceholder}
          />
        </div>
      </div>

      <div className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        <span>{selectedSubcategory ? pickText(selectedSubcategory.title, language) : selectedCategory ? pickText(selectedCategory.title, language) : copy.title}</span>
      </div>

      {pageEntries.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {pageEntries.map((entry, index) => {
            if (entry.type === 'custom') return <CustomCard key="custom" copy={copy} />;
            if (entry.type === 'category') {
              return (
                <CategoryCard
                  key={entry.category.id}
                  category={entry.category}
                  language={language}
                  onSelect={() => selectCategory(entry.category.id)}
                />
              );
            }
            if (entry.type === 'subcategory') {
              return (
                <SubcategoryCard
                  key={entry.subcategory.id}
                  subcategory={entry.subcategory}
                  language={language}
                  onSelect={() => selectSubcategory(entry.subcategory.id)}
                />
              );
            }
            return <ItemCard key={entry.item.id} item={entry.item} language={language} />;
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {copy.empty}
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination className="pt-2">
          <PaginationContent className="w-full justify-center gap-2">
            <PaginationItem>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-10 cursor-pointer px-4 text-sm disabled:cursor-not-allowed"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {copy.previous}
              </Button>
            </PaginationItem>
            <PaginationItem>
              <div className="h-10 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                {safePage} / {totalPages}
              </div>
            </PaginationItem>
            <PaginationItem>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-10 cursor-pointer px-4 text-sm disabled:cursor-not-allowed"
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
              >
                {copy.next}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
