"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, Search, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import type { ImagePrankCatalogCategoryDTO, ImagePrankCatalogItemDTO, LocalizedCatalogTextDTO } from '@/shared/types';

const PAGE_SIZE = 18;

const COPY: Record<AppLanguageCode, {
  title: string;
  searchPlaceholder: string;
  customTitle: string;
  customSubtitle: string;
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
    back: 'Категории',
    empty: 'Prank-картинок пока нет.',
    previous: 'Назад',
    next: 'Вперёд',
  },
};

type Props = {
  categories: ImagePrankCatalogCategoryDTO[];
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
  ].some((value) => value.toLowerCase().includes(query)) || category.items.some((item) => itemMatches(item, query, language));
}

function PreviewGrid({ images, label }: { images: string[]; label: string }) {
  const preview = Array.from({ length: 4 }, (_, index) => images[index] ?? null);
  return (
    <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-gray-200 dark:bg-gray-800">
      {preview.map((imageUrl, index) => (
        <div key={`${imageUrl ?? 'empty'}-${index}`} className="overflow-hidden bg-gray-100 dark:bg-gray-900">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className={cn('h-full w-full', index % 2 === 0 ? 'bg-gray-100 dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950')} />
          )}
        </div>
      ))}
    </div>
  );
}

function CustomCard({ copy }: { copy: (typeof COPY)[AppLanguageCode] }) {
  return (
    <Link href="/image-prank/custom" className="block cursor-pointer focus-visible:outline-none">
      <article className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/30 dark:hover:border-blue-800">
        <div className="flex aspect-[9/16] flex-col items-center justify-center gap-3 p-4 text-center">
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
  return (
    <button type="button" onClick={onSelect} className="block w-full cursor-pointer text-left focus-visible:outline-none">
      <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700">
        <div className="relative aspect-[9/16] w-full">
          <PreviewGrid images={category.items.map((item) => item.imageUrl)} label={title} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 text-white">
            <h3 className="truncate text-sm font-semibold leading-none">{title}</h3>
          </div>
        </div>
      </article>
    </button>
  );
}

function ItemCard({ item, language }: { item: ImagePrankCatalogItemDTO; language: AppLanguageCode }) {
  const title = pickText(item.title, language);
  return (
    <Link href={`/image-prank/${encodeURIComponent(item.slug)}`} className="block cursor-pointer focus-visible:outline-none">
      <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700">
        <div className="relative aspect-[9/16] w-full bg-gray-100 dark:bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const normalizedQuery = normalizeSearch(query);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const hasMultipleCategories = categories.length > 1;

  const rootCategories = useMemo(() => (
    hasMultipleCategories
      ? categories.filter((category) => categoryMatches(category, normalizedQuery, language))
      : []
  ), [categories, hasMultipleCategories, language, normalizedQuery]);

  const rootItems = useMemo(() => {
    if (hasMultipleCategories) return [];
    const onlyCategory = categories[0] ?? null;
    return onlyCategory ? onlyCategory.items.filter((item) => itemMatches(item, normalizedQuery, language)) : [];
  }, [categories, hasMultipleCategories, language, normalizedQuery]);

  const categoryItems = useMemo(() => (
    selectedCategory
      ? selectedCategory.items.filter((item) => itemMatches(item, normalizedQuery, language))
      : []
  ), [language, normalizedQuery, selectedCategory]);

  const entries = selectedCategory
    ? categoryItems.map((item) => ({ type: 'item' as const, item }))
    : [
        { type: 'custom' as const },
        ...(hasMultipleCategories
          ? rootCategories.map((category) => ({ type: 'category' as const, category }))
          : rootItems.map((item) => ({ type: 'item' as const, item }))),
      ];
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = entries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setPage(1);
  };

  const resetCategory = () => {
    setSelectedCategoryId(null);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-14">
      <div className="flex min-h-10 items-center gap-2">
        <button
          type="button"
          onClick={resetCategory}
          className={cn(
            'inline-flex h-9 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-sm font-medium text-blue-700 transition-[width,opacity,transform,margin,padding,border] duration-200 ease-out dark:text-blue-300',
            selectedCategory
              ? 'pointer-events-auto mr-2 w-36 cursor-pointer border border-blue-200/80 bg-white/80 px-3 opacity-100 translate-x-0 shadow-sm backdrop-blur-sm hover:border-blue-300 hover:text-blue-800 dark:border-blue-800/80 dark:bg-gray-950/70'
              : 'pointer-events-none mr-0 h-0 min-h-0 w-0 min-w-0 cursor-default border-0 px-0 opacity-0 -translate-x-2',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{copy.back}</span>
        </button>
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

      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span>{selectedCategory ? pickText(selectedCategory.title, language) : copy.title}</span>
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
