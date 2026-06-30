"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Download, FolderOpen, Images, Loader2, Pencil, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type Category = {
  id: string;
  slug: string;
  titleEn: string;
  titleRu: string;
  subtitleEn: string | null;
  isActive: boolean;
  priority: number;
};

type Subcategory = {
  id: string;
  categoryId: string;
  slug: string;
  titleEn: string;
  titleRu: string;
  subtitleEn: string | null;
  isActive: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
};

type Item = {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  slug: string;
  titleEn: string;
  descriptionEn: string | null;
  previewImageUrl: string | null;
  isPublic: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
  subcategory: { id: string; slug: string; titleEn: string } | null;
};

type PaywallAttempt = {
  id: string;
  userId: string;
  projectId: string | null;
  clientAttemptId: string;
  promptText: string | null;
  promptMode: string | null;
  projectExperience: string | null;
  durationSeconds: number | null;
  tokenCost: number | null;
  tokenBalance: number | null;
  mainPageMode: string | null;
  mainPageCategoryId: string | null;
  characterSlug: string | null;
  templateId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  intent: string | null;
  sourceToolSlug: string | null;
  referrerOrigin: string | null;
  referrerPath: string | null;
  landingPath: string | null;
  createdAt: string;
  user: { id: string; email: string | null; name: string | null; isAdmin: boolean; createdAt: string } | null;
};

type BulkImportMetadata = {
  categorySlug?: string;
  categoryTitle?: string;
  categoryPriority?: number | string;
  subcategorySlug?: string;
  subcategoryTitle?: string;
  subcategoryPriority?: number | string;
  slug?: string;
  title?: string;
  description?: string;
  searchText?: string;
  priority?: number | string;
  isPublic?: boolean;
};

type BulkImportItem = {
  id: string;
  folderName: string;
  file: File;
  previewUrl: string;
  metadata: Required<BulkImportMetadata>;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error: string | null;
};

type BulkPathInfo = {
  folderName: string;
  categoryTitle: string | null;
  subcategoryTitle: string | null;
};

const emptyCategoryForm = {
  slug: '',
  title: '',
  subtitle: '',
  priority: '0',
  isActive: true,
};

const emptySubcategoryForm = {
  categoryId: '',
  slug: '',
  title: '',
  subtitle: '',
  priority: '0',
  isActive: true,
};

const emptyItemForm = {
  categoryId: '',
  subcategoryId: '',
  slug: '',
  title: '',
  description: '',
  searchText: '',
  priority: '0',
  isPublic: false,
};

const directoryInputProps = {
  webkitdirectory: '',
  directory: '',
} as Record<string, string>;

type DeleteTarget =
  | { kind: 'item'; id: string; title: string }
  | { kind: 'category'; id: string; title: string }
  | { kind: 'subcategory'; id: string; title: string };

type AdminImagePranksTab = 'pranks' | 'categories' | 'subcategories' | 'paywall';

const ADMIN_IMAGE_PRANK_TABS = new Set<AdminImagePranksTab>(['pranks', 'categories', 'subcategories', 'paywall']);

function normalizeAdminImagePranksTab(value: string | null | undefined): AdminImagePranksTab {
  return ADMIN_IMAGE_PRANK_TABS.has(value as AdminImagePranksTab) ? value as AdminImagePranksTab : 'pranks';
}

function slugifyImportValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'image-prank';
}

function parseImportPriority(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : fallback;
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function toBulkMetadata(raw: unknown, pathInfo: BulkPathInfo): Required<BulkImportMetadata> {
  const source = raw && typeof raw === 'object' ? raw as BulkImportMetadata : {};
  const folderName = pathInfo.folderName;
  const title = typeof source.title === 'string' && source.title.trim()
    ? source.title.trim()
    : folderName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
  const categoryTitle = typeof source.categoryTitle === 'string' && source.categoryTitle.trim()
    ? source.categoryTitle.trim()
    : pathInfo.categoryTitle || 'Main';
  const subcategoryTitle = typeof source.subcategoryTitle === 'string' && source.subcategoryTitle.trim()
    ? source.subcategoryTitle.trim()
    : pathInfo.subcategoryTitle || '';
  return {
    categorySlug: typeof source.categorySlug === 'string' && source.categorySlug.trim()
      ? slugifyImportValue(source.categorySlug)
      : slugifyImportValue(categoryTitle),
    categoryTitle,
    categoryPriority: parseImportPriority(source.categoryPriority),
    subcategorySlug: typeof source.subcategorySlug === 'string' && source.subcategorySlug.trim()
      ? slugifyImportValue(source.subcategorySlug)
      : subcategoryTitle ? slugifyImportValue(subcategoryTitle) : '',
    subcategoryTitle,
    subcategoryPriority: parseImportPriority(source.subcategoryPriority),
    slug: typeof source.slug === 'string' && source.slug.trim()
      ? slugifyImportValue(source.slug)
      : slugifyImportValue(title),
    title,
    description: typeof source.description === 'string' ? source.description.trim() : '',
    searchText: typeof source.searchText === 'string' ? source.searchText.trim() : '',
    priority: parseImportPriority(source.priority),
    isPublic: typeof source.isPublic === 'boolean' ? source.isPublic : true,
  };
}

function bulkPathInfo(file: File): BulkPathInfo | null {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.slice(0, -1).some((part) => part.startsWith('_'))) return null;
  const folderName = parts.at(-2) ?? '';
  if (!folderName) return null;
  return {
    folderName,
    categoryTitle: parts.length >= 4 ? parts.at(-4) ?? null : parts.length >= 3 ? parts.at(-3) ?? null : null,
    subcategoryTitle: parts.length >= 4 ? parts.at(-3) ?? null : null,
  };
}

function isBulkImageFile(file: File) {
  return /^image\/(png|jpeg|webp)$/.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

function isMetadataFile(file: File) {
  return file.name.toLowerCase() === 'metadata.json';
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Failed to read image dimensions'));
      image.src = previewUrl;
    });
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
}

function formatAdminDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function filenameFromContentDisposition(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/i) ?? header?.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || null;
}

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

export function AdminImagePranksManager({ initialTab = 'pranks' }: { initialTab?: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [subcategoryForm, setSubcategoryForm] = useState(emptySubcategoryForm);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [itemImagePreviewUrl, setItemImagePreviewUrl] = useState<string | null>(null);
  const [editingItemPreviewUrl, setEditingItemPreviewUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [activeTab, setActiveTab] = useState<AdminImagePranksTab>(() => normalizeAdminImagePranksTab(initialTab));
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkImportItem[]>([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [paywallAttempts, setPaywallAttempts] = useState<PaywallAttempt[]>([]);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [paywallExporting, setPaywallExporting] = useState(false);
  const [paywallPage, setPaywallPage] = useState(1);
  const [paywallPageSize, setPaywallPageSize] = useState(50);
  const [paywallTotalPages, setPaywallTotalPages] = useState(1);
  const [paywallTotal, setPaywallTotal] = useState(0);
  const [paywallFilters, setPaywallFilters] = useState({ q: '', userId: '', from: '', to: '' });
  const bulkPreviewUrlsRef = useRef<string[]>([]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === itemForm.categoryId) ?? null,
    [categories, itemForm.categoryId],
  );
  const itemSubcategoryOptions = useMemo(
    () => subcategories.filter((subcategory) => subcategory.categoryId === itemForm.categoryId),
    [itemForm.categoryId, subcategories],
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [categoryResult, subcategoryResult, itemResult] = await Promise.all([
        Api.adminImagePrankCategoriesList(),
        Api.adminImagePrankSubcategoriesList(),
        Api.adminImagePranksList({
          q: query,
          categoryId: categoryFilter || null,
          subcategoryId: subcategoryFilter || null,
          page: 1,
          pageSize: 100,
        }),
      ]);
      setCategories(categoryResult.items);
      setSubcategories(subcategoryResult.items as Subcategory[]);
      setItems(itemResult.items as Item[]);
      setItemForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || categoryResult.items[0]?.id || '',
      }));
      setSubcategoryForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || categoryResult.items[0]?.id || '',
      }));
    } finally {
      setLoading(false);
    }
  };

  const loadPaywallAttempts = async (page = paywallPage) => {
    setPaywallLoading(true);
    try {
      const result = await Api.adminPaywallAttemptsList({
        q: paywallFilters.q,
        userId: paywallFilters.userId,
        from: paywallFilters.from,
        to: paywallFilters.to,
        page,
        pageSize: paywallPageSize,
      });
      setPaywallAttempts(result.items as PaywallAttempt[]);
      setPaywallPage(result.page);
      setPaywallPageSize(result.pageSize);
      setPaywallTotal(result.total);
      setPaywallTotalPages(result.totalPages);
    } finally {
      setPaywallLoading(false);
    }
  };

  const updateActiveTab = (nextTab: string) => {
    const normalizedTab = normalizeAdminImagePranksTab(nextTab);
    setActiveTab(normalizedTab);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (normalizedTab === 'pranks') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', normalizedTab);
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActiveTab(normalizeAdminImagePranksTab(initialTab));
  }, [initialTab]);

  useEffect(() => () => {
    bulkPreviewUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
  }, []);

  useEffect(() => {
    if (activeTab === 'paywall') {
      void loadPaywallAttempts(paywallPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, paywallPage, paywallPageSize]);

  useEffect(() => {
    if (!itemImage) {
      setItemImagePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(itemImage);
    setItemImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [itemImage]);

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryForm.slug.trim() || !categoryForm.title.trim()) {
      toast.error('Slug and title are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: categoryForm.slug,
        title: categoryForm.title,
        subtitle: categoryForm.subtitle || undefined,
        priority: Number.parseInt(categoryForm.priority, 10) || 0,
        isActive: categoryForm.isActive,
      };
      if (editingCategoryId) {
        await Api.adminImagePrankCategoriesUpdate(editingCategoryId, payload);
      } else {
        await Api.adminImagePrankCategoriesCreate(payload);
      }
      setCategoryForm(emptyCategoryForm);
      setEditingCategoryId(null);
      await loadAll();
      toast.success('Category saved');
    } finally {
      setSaving(false);
    }
  };

  const submitSubcategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!subcategoryForm.categoryId || !subcategoryForm.slug.trim() || !subcategoryForm.title.trim()) {
      toast.error('Category, slug, and title are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId: subcategoryForm.categoryId,
        slug: subcategoryForm.slug,
        title: subcategoryForm.title,
        subtitle: subcategoryForm.subtitle || undefined,
        priority: Number.parseInt(subcategoryForm.priority, 10) || 0,
        isActive: subcategoryForm.isActive,
      };
      if (editingSubcategoryId) {
        await Api.adminImagePrankSubcategoriesUpdate(editingSubcategoryId, payload);
      } else {
        await Api.adminImagePrankSubcategoriesCreate(payload);
      }
      setSubcategoryForm({ ...emptySubcategoryForm, categoryId: categories[0]?.id ?? '' });
      setEditingSubcategoryId(null);
      await loadAll();
      toast.success('Subcategory saved');
    } finally {
      setSaving(false);
    }
  };

  const submitItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!itemForm.categoryId || !itemForm.slug.trim() || !itemForm.title.trim()) {
      toast.error('Category, slug, and title are required');
      return;
    }
    if (!editingItemId && !itemImage) {
      toast.error('Image is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId: itemForm.categoryId,
        subcategoryId: itemForm.subcategoryId || null,
        slug: itemForm.slug,
        title: itemForm.title,
        description: itemForm.description,
        searchText: itemForm.searchText,
        priority: Number.parseInt(itemForm.priority, 10) || 0,
        isPublic: itemForm.isPublic,
        ...(itemImage ? { image: itemImage } : {}),
      };
      if (editingItemId) {
        await Api.adminImagePrankUpdate(editingItemId, payload);
      } else if (itemImage) {
        await Api.adminImagePrankCreate({ ...payload, image: itemImage });
      }
      setItemForm({ ...emptyItemForm, categoryId: selectedCategory?.id ?? categories[0]?.id ?? '' });
      setEditingItemId(null);
      setItemImage(null);
      setEditingItemPreviewUrl(null);
      await loadAll();
      toast.success('Prank image saved');
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category: Category) => {
    setActiveTab('categories');
    setEditingCategoryId(category.id);
    setCategoryForm({
      slug: category.slug,
      title: category.titleEn,
      subtitle: category.subtitleEn ?? '',
      priority: String(category.priority),
      isActive: category.isActive,
    });
  };

  const editSubcategory = (subcategory: Subcategory) => {
    setActiveTab('subcategories');
    setEditingSubcategoryId(subcategory.id);
    setSubcategoryForm({
      categoryId: subcategory.categoryId,
      slug: subcategory.slug,
      title: subcategory.titleEn,
      subtitle: subcategory.subtitleEn ?? '',
      priority: String(subcategory.priority),
      isActive: subcategory.isActive,
    });
  };

  const editItem = (item: Item) => {
    setActiveTab('pranks');
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId ?? '',
      slug: item.slug,
      title: item.titleEn,
      description: item.descriptionEn ?? '',
      searchText: '',
      priority: String(item.priority),
      isPublic: item.isPublic,
    });
    setItemImage(null);
    setEditingItemPreviewUrl(item.previewImageUrl);
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemImage(null);
    setEditingItemPreviewUrl(null);
    setItemForm({ ...emptyItemForm, categoryId: categories[0]?.id ?? '', subcategoryId: '' });
  };

  const replaceBulkItems = (nextItems: BulkImportItem[]) => {
    bulkPreviewUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    bulkPreviewUrlsRef.current = nextItems.map((item) => item.previewUrl);
    setBulkItems(nextItems);
  };

  const updateBulkItemMetadata = (id: string, patch: Partial<BulkImportMetadata>) => {
    setBulkItems((current) => current.map((item) => (
      item.id === id
        ? { ...item, metadata: { ...item.metadata, ...patch } }
        : item
    )));
  };

  const parseBulkDirectory = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    setBulkParsing(true);
    try {
      const grouped = new Map<string, { image?: File; metadata?: File; pathInfo: BulkPathInfo }>();
      for (const file of selectedFiles) {
        const pathInfo = bulkPathInfo(file);
        if (!pathInfo) continue;
        const groupKey = [
          pathInfo.categoryTitle ?? '',
          pathInfo.subcategoryTitle ?? '',
          pathInfo.folderName,
        ].join('/');
        const group = grouped.get(groupKey) ?? { pathInfo };
        if (isBulkImageFile(file) && !group.image) {
          group.image = file;
        } else if (isMetadataFile(file) && !group.metadata) {
          group.metadata = file;
        }
        grouped.set(groupKey, group);
      }

      const nextItems: BulkImportItem[] = [];
      let skippedBadImages = 0;
      for (const group of grouped.values()) {
        if (!group.image || !group.metadata) continue;
        const dimensions = await readImageDimensions(group.image);
        if (dimensions.width >= dimensions.height) {
          skippedBadImages += 1;
          continue;
        }
        const parsedMetadata = await readJsonFile(group.metadata);
        const metadata = toBulkMetadata(parsedMetadata, group.pathInfo);
        nextItems.push({
          id: `${group.pathInfo.folderName}-${group.image.name}`,
          folderName: group.pathInfo.folderName,
          file: group.image,
          previewUrl: URL.createObjectURL(group.image),
          metadata,
          status: 'pending',
          error: null,
        });
      }

      replaceBulkItems(nextItems);
      if (nextItems.length === 0) {
        toast.error('No valid prank items found. Each item subfolder needs one image and one metadata JSON file.');
      } else {
        const skippedText = skippedBadImages > 0
          ? ` Skipped ${skippedBadImages.toLocaleString()} landscape/contact-sheet image${skippedBadImages === 1 ? '' : 's'}.`
          : '';
        toast.success(`Loaded ${nextItems.length.toLocaleString()} prank items for preview.${skippedText}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse import directory');
    } finally {
      setBulkParsing(false);
    }
  };

  const uploadBulkItems = async () => {
    if (bulkUploading || bulkItems.length === 0) return;
    setBulkUploading(true);
    try {
      const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
      const subcategoryByKey = new Map(subcategories.map((subcategory) => [`${subcategory.categoryId}:${subcategory.slug}`, subcategory]));
      for (const item of bulkItems) {
        if (item.status === 'done') continue;
        setBulkItems((current) => current.map((candidate) => (
          candidate.id === item.id ? { ...candidate, status: 'uploading', error: null } : candidate
        )));

        try {
          let category = categoryBySlug.get(item.metadata.categorySlug);
          if (!category) {
            category = await Api.adminImagePrankCategoriesCreate({
              slug: item.metadata.categorySlug,
              title: item.metadata.categoryTitle,
              isActive: true,
              priority: Number(item.metadata.categoryPriority),
            }) as Category;
            categoryBySlug.set(category.slug, category);
          }
          let subcategoryId: string | null = null;
          if (item.metadata.subcategorySlug) {
            const key = `${category.id}:${item.metadata.subcategorySlug}`;
            let subcategory = subcategoryByKey.get(key);
            if (!subcategory) {
              subcategory = await Api.adminImagePrankSubcategoriesCreate({
                categoryId: category.id,
                slug: item.metadata.subcategorySlug,
                title: item.metadata.subcategoryTitle || item.metadata.subcategorySlug,
                isActive: true,
                priority: Number(item.metadata.subcategoryPriority),
              }) as Subcategory;
              subcategoryByKey.set(key, subcategory);
            }
            subcategoryId = subcategory.id;
          }

          await Api.adminImagePrankCreate({
            categoryId: category.id,
            subcategoryId,
            slug: item.metadata.slug,
            title: item.metadata.title,
            description: item.metadata.description,
            searchText: item.metadata.searchText,
            priority: Number(item.metadata.priority),
            isPublic: item.metadata.isPublic,
            image: item.file,
          });
          setBulkItems((current) => current.map((candidate) => (
            candidate.id === item.id ? { ...candidate, status: 'done', error: null } : candidate
          )));
        } catch (error) {
          const message = error && typeof error === 'object' && 'error' in error
            ? String((error as { error?: { message?: string } }).error?.message ?? 'Upload failed')
            : error instanceof Error ? error.message : 'Upload failed';
          setBulkItems((current) => current.map((candidate) => (
            candidate.id === item.id ? { ...candidate, status: 'error', error: message } : candidate
          )));
        }
      }
      await loadAll();
      toast.success('Bulk upload finished');
    } finally {
      setBulkUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'item') {
        await Api.adminImagePrankDelete(deleteTarget.id, { deleteFiles: true });
        toast.success('Prank image deleted');
      } else if (deleteTarget.kind === 'subcategory') {
        await Api.adminImagePrankSubcategoriesDelete(deleteTarget.id, { deleteFiles: true });
        toast.success('Subcategory deleted');
      } else {
        await Api.adminImagePrankCategoriesDelete(deleteTarget.id, { deleteFiles: true });
        toast.success('Category deleted');
      }
      setDeleteTarget(null);
      await loadAll();
    } finally {
      setDeleting(false);
    }
  };

  const applyPaywallFilters = () => {
    setPaywallPage(1);
    void loadPaywallAttempts(1);
  };

  const exportPaywallAttempts = async () => {
    setPaywallExporting(true);
    try {
      const qp = new URLSearchParams();
      qp.set('export', '1');
      if (paywallFilters.q.trim()) qp.set('q', paywallFilters.q.trim());
      if (paywallFilters.userId.trim()) qp.set('userId', paywallFilters.userId.trim());
      if (paywallFilters.from) qp.set('from', paywallFilters.from);
      if (paywallFilters.to) qp.set('to', paywallFilters.to);
      const response = await fetch(`/api/admin/project-attempts/paywall?${qp.toString()}`);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromContentDisposition(response.headers.get('content-disposition')) || 'paywall-attempts.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Paywall log exported');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export paywall log');
    } finally {
      setPaywallExporting(false);
    }
  };

  const displayedItemImagePreviewUrl = itemImagePreviewUrl ?? editingItemPreviewUrl;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Images className="h-6 w-6 text-blue-500" />
          Image Pranks
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-300">Manage prank catalog categories and source images.</p>
      </div>

      <Tabs value={activeTab} onValueChange={updateActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pranks" className="cursor-pointer">Prank images</TabsTrigger>
          <TabsTrigger value="categories" className="cursor-pointer">Categories</TabsTrigger>
          <TabsTrigger value="subcategories" className="cursor-pointer">Subcategories</TabsTrigger>
          <TabsTrigger value="paywall" className="cursor-pointer">Paywall logs</TabsTrigger>
        </TabsList>

        <TabsContent value="pranks" className="space-y-4">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Bulk upload</CardTitle>
                <CardDescription>Choose a folder where each item is a subfolder with one image and metadata.json.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                  {bulkParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                  Choose dir
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    {...directoryInputProps}
                    onChange={(event) => {
                      void parseBulkDirectory(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </label>
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={bulkUploading || bulkParsing || bulkItems.length === 0}
                  onClick={() => void uploadBulkItems()}
                >
                  {bulkUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload selected
                </Button>
              </div>
            </CardHeader>
            {bulkItems.length > 0 ? (
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Previewing {bulkItems.length.toLocaleString()} items in directory order. Priority values are saved for the public catalog order, but they do not reorder this admin preview.
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {bulkItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                      <div className="flex aspect-[9/16] items-center justify-center overflow-hidden rounded-md bg-gray-50 dark:bg-gray-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.previewUrl} alt={item.metadata.title} className="h-full w-full object-contain" />
                      </div>
                      <div className="mt-2 min-w-0 space-y-1 text-sm">
                        <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.metadata.title}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {item.metadata.categoryTitle}
                          {item.metadata.subcategoryTitle ? ` / ${item.metadata.subcategoryTitle}` : ''}
                          {' / '}
                          {item.metadata.slug}
                        </div>
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2 pt-1 text-xs">
                          <Label htmlFor={`bulk-priority-${item.id}`} className="text-xs text-gray-500 dark:text-gray-400">
                            Priority
                          </Label>
                          <Input
                            id={`bulk-priority-${item.id}`}
                            type="number"
                            value={String(item.metadata.priority)}
                            disabled={bulkUploading || item.status === 'uploading' || item.status === 'done'}
                            className="h-8"
                            onChange={(event) => updateBulkItemMetadata(item.id, {
                              priority: parseImportPriority(event.target.value),
                            })}
                          />
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Category priority {item.metadata.categoryPriority}
                          {item.metadata.subcategoryTitle ? ` / Subcategory priority ${item.metadata.subcategoryPriority}` : ''}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {item.status === 'uploading' ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                              <span className="text-blue-700 dark:text-blue-300">Uploading</span>
                            </>
                          ) : item.status === 'done' ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-700 dark:text-emerald-300">Uploaded</span>
                            </>
                          ) : item.status === 'error' ? (
                            <span className="text-red-600 dark:text-red-300">{item.error ?? 'Upload failed'}</span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Ready</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : null}
          </Card>

          <Card>
          <CardHeader>
            <CardTitle>{editingItemId ? 'Edit prank image' : 'New prank image'}</CardTitle>
            <CardDescription>Public images appear after Custom mix in the catalog.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submitItem}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="prank-item-category">Category</Label>
                  <select
                    id="prank-item-category"
                    className="h-10 w-full cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                    value={itemForm.categoryId}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, categoryId: event.target.value, subcategoryId: '' }))}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.titleEn}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-item-subcategory">Subcategory</Label>
                  <select
                    id="prank-item-subcategory"
                    className="h-10 w-full cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                    value={itemForm.subcategoryId}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, subcategoryId: event.target.value }))}
                  >
                    <option value="">No subcategory</option>
                    {itemSubcategoryOptions.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{subcategory.titleEn}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-item-slug">Slug</Label>
                  <Input id="prank-item-slug" value={itemForm.slug} onChange={(event) => setItemForm((prev) => ({ ...prev, slug: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-item-title">Title</Label>
                  <Input id="prank-item-title" value={itemForm.title} onChange={(event) => setItemForm((prev) => ({ ...prev, title: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-item-priority">Priority</Label>
                  <Input id="prank-item-priority" type="number" value={itemForm.priority} onChange={(event) => setItemForm((prev) => ({ ...prev, priority: event.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="prank-item-description">Description</Label>
                  <Textarea id="prank-item-description" value={itemForm.description} onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="prank-item-search">Keywords</Label>
                  <Input id="prank-item-search" value={itemForm.searchText} onChange={(event) => setItemForm((prev) => ({ ...prev, searchText: event.target.value }))} />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Extra keywords, aliases, and phrases used only for catalog search.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 text-sm dark:border-gray-800">
                    <input type="checkbox" checked={itemForm.isPublic} onChange={(event) => setItemForm((prev) => ({ ...prev, isPublic: event.target.checked }))} />
                    Public
                  </label>
                  <Button type="submit" className="cursor-pointer" disabled={saving || categories.length === 0}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Save prank
                  </Button>
                  {editingItemId ? (
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={resetItemForm}>Cancel</Button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prank-item-image">Image</Label>
                <Input id="prank-item-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setItemImage(event.target.files?.[0] ?? null)} />
                <div className="flex min-h-80 items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
                  {displayedItemImagePreviewUrl ? (
                    <div className="w-full space-y-2">
                      <div className="flex h-72 w-full items-center justify-center overflow-hidden rounded-md bg-white dark:bg-gray-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={displayedItemImagePreviewUrl} alt="Selected prank preview" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0 text-sm">
                        <div className="font-medium">{itemImage ? 'Selected image preview' : 'Current image'}</div>
                        {itemImage ? (
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400">{itemImage.name}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">Choose an image to preview it here.</div>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Catalog</CardTitle>
                <CardDescription>{items.length.toLocaleString()} prank images</CardDescription>
              </div>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void loadAll()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pranks" />
                <select
                  className="h-10 cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setSubcategoryFilter('');
                  }}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.titleEn}</option>
                  ))}
                </select>
                <select
                  className="h-10 cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                  value={subcategoryFilter}
                  onChange={(event) => setSubcategoryFilter(event.target.value)}
                >
                  <option value="">All subcategories</option>
                  {subcategories
                    .filter((subcategory) => !categoryFilter || subcategory.categoryId === categoryFilter)
                    .map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{subcategory.titleEn}</option>
                    ))}
                </select>
              </div>
              {loading ? (
                <div className="flex h-32 items-center justify-center text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700">
                  No prank images yet.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <div key={item.id} className="grid min-h-32 grid-cols-[128px_minmax(0,1fr)] gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900">
                        {item.previewImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewImageUrl} alt={item.titleEn} className="h-full w-full object-contain" />
                        ) : (
                          <Images className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-semibold">{item.titleEn}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {item.category?.titleEn ?? 'No category'}
                          {item.subcategory ? ` / ${item.subcategory.titleEn}` : ''}
                          {' / '}
                          {item.slug}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Priority {item.priority} / {item.isPublic ? 'Public' : 'Hidden'}</div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => editItem(item)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 cursor-pointer"
                            onClick={async () => {
                              await Api.adminImagePrankUpdate(item.id, { isPublic: !item.isPublic });
                              await loadAll();
                            }}
                          >
                            {item.isPublic ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-8 cursor-pointer"
                            onClick={() => setDeleteTarget({ kind: 'item', id: item.id, title: item.titleEn })}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcategories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingSubcategoryId ? 'Edit subcategory' : 'New subcategory'}</CardTitle>
              <CardDescription>Subcategories appear as cards inside their parent Image Prank category.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={submitSubcategory}>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-subcategory-category">Category</Label>
                  <select
                    id="prank-subcategory-category"
                    className="h-10 w-full cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                    value={subcategoryForm.categoryId}
                    onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.titleEn}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-subcategory-slug">Slug</Label>
                  <Input id="prank-subcategory-slug" value={subcategoryForm.slug} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, slug: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-subcategory-title">Title</Label>
                  <Input id="prank-subcategory-title" value={subcategoryForm.title} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, title: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-subcategory-priority">Priority</Label>
                  <Input id="prank-subcategory-priority" type="number" value={subcategoryForm.priority} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, priority: event.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="prank-subcategory-subtitle">Subtitle</Label>
                  <Input id="prank-subcategory-subtitle" value={subcategoryForm.subtitle} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, subtitle: event.target.value }))} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 text-sm dark:border-gray-800">
                    <input type="checkbox" checked={subcategoryForm.isActive} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                    Active
                  </label>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" className="cursor-pointer" disabled={saving || categories.length === 0}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Save subcategory
                  </Button>
                  {editingSubcategoryId ? (
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={() => {
                      setEditingSubcategoryId(null);
                      setSubcategoryForm({ ...emptySubcategoryForm, categoryId: categories[0]?.id ?? '' });
                    }}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Subcategories</CardTitle>
                <CardDescription>{subcategories.length.toLocaleString()} subcategories</CardDescription>
              </div>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void loadAll()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : subcategories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700">
                  No subcategories yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{subcategory.titleEn}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{subcategory.category?.titleEn ?? 'No category'} / {subcategory.slug}</div>
                        {subcategory.subtitleEn ? (
                          <div className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{subcategory.subtitleEn}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Priority {subcategory.priority} / {subcategory.isActive ? 'Active' : 'Hidden'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => editSubcategory(subcategory)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8 cursor-pointer"
                          onClick={() => setDeleteTarget({ kind: 'subcategory', id: subcategory.id, title: subcategory.titleEn })}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingCategoryId ? 'Edit category' : 'New category'}</CardTitle>
              <CardDescription>Categories appear on the Image Prank catalog root.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCategory}>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-category-slug">Slug</Label>
                  <Input id="prank-category-slug" value={categoryForm.slug} onChange={(event) => setCategoryForm((prev) => ({ ...prev, slug: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-category-title">Title</Label>
                  <Input id="prank-category-title" value={categoryForm.title} onChange={(event) => setCategoryForm((prev) => ({ ...prev, title: event.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="prank-category-subtitle">Subtitle</Label>
                  <Input id="prank-category-subtitle" value={categoryForm.subtitle} onChange={(event) => setCategoryForm((prev) => ({ ...prev, subtitle: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prank-category-priority">Priority</Label>
                  <Input id="prank-category-priority" type="number" value={categoryForm.priority} onChange={(event) => setCategoryForm((prev) => ({ ...prev, priority: event.target.value }))} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 text-sm dark:border-gray-800">
                    <input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                    Active
                  </label>
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <Button type="submit" className="cursor-pointer" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Save category
                  </Button>
                  {editingCategoryId ? (
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={() => {
                      setEditingCategoryId(null);
                      setCategoryForm(emptyCategoryForm);
                    }}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>{categories.length.toLocaleString()} categories</CardDescription>
              </div>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void loadAll()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : categories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700">
                  No categories yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {categories.map((category) => (
                    <div key={category.id} className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{category.titleEn}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{category.slug}</div>
                        {category.subtitleEn ? (
                          <div className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{category.subtitleEn}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Priority {category.priority} / {category.isActive ? 'Active' : 'Hidden'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => editCategory(category)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8 cursor-pointer"
                          onClick={() => setDeleteTarget({ kind: 'category', id: category.id, title: category.titleEn })}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paywall" className="space-y-4">
          <Card>
            <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Paywall before project creation</CardTitle>
                <CardDescription>
                  Stored paywall events with prompt text and user info. Telegram sending for these events is disabled.
                </CardDescription>
              </div>
              <Button type="button" className="cursor-pointer" variant="outline" onClick={() => void exportPaywallAttempts()} disabled={paywallExporting}>
                {paywallExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export JSON
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_160px_120px_auto]">
                <Input
                  value={paywallFilters.q}
                  onChange={(event) => setPaywallFilters((prev) => ({ ...prev, q: event.target.value }))}
                  placeholder="Search prompt, email, name, user id"
                />
                <Input
                  value={paywallFilters.userId}
                  onChange={(event) => setPaywallFilters((prev) => ({ ...prev, userId: event.target.value }))}
                  placeholder="User ID"
                />
                <Input
                  type="date"
                  value={paywallFilters.from}
                  onChange={(event) => setPaywallFilters((prev) => ({ ...prev, from: event.target.value }))}
                />
                <Input
                  type="date"
                  value={paywallFilters.to}
                  onChange={(event) => setPaywallFilters((prev) => ({ ...prev, to: event.target.value }))}
                />
                <select
                  className="h-10 cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                  value={paywallPageSize}
                  onChange={(event) => {
                    setPaywallPageSize(Number(event.target.value));
                    setPaywallPage(1);
                  }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <Button type="button" className="cursor-pointer" onClick={applyPaywallFilters} disabled={paywallLoading}>
                  {paywallLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Apply
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div>
                  {paywallTotal.toLocaleString()} events, page {paywallPage.toLocaleString()} of {paywallTotalPages.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={paywallLoading || paywallPage <= 1}
                    onClick={() => setPaywallPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={paywallLoading || paywallPage >= paywallTotalPages}
                    onClick={() => setPaywallPage((page) => Math.min(paywallTotalPages, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>

              {paywallLoading ? (
                <div className="flex h-32 items-center justify-center text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : paywallAttempts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700">
                  No paywall events found.
                </div>
              ) : (
                <div className="space-y-3">
                  {paywallAttempts.map((attempt) => (
                    <div key={attempt.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatAdminDate(attempt.createdAt)}</span>
                            <span>{attempt.projectExperience ?? 'unknown'}</span>
                            <span>{attempt.promptMode ?? 'no mode'}</span>
                            {attempt.durationSeconds !== null ? <span>{attempt.durationSeconds}s</span> : null}
                            {attempt.tokenCost !== null || attempt.tokenBalance !== null ? (
                              <span>Need {attempt.tokenCost ?? '—'} / balance {attempt.tokenBalance ?? '—'}</span>
                            ) : null}
                          </div>
                          <div className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                            {attempt.promptText || 'No prompt text'}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            {attempt.mainPageMode ? <span>Mode: {attempt.mainPageMode}</span> : null}
                            {attempt.mainPageCategoryId ? <span>Category: {attempt.mainPageCategoryId}</span> : null}
                            {attempt.characterSlug ? <span>Character: {attempt.characterSlug}</span> : null}
                            {attempt.utmSource || attempt.utmMedium || attempt.utmCampaign ? (
                              <span>UTM: {attempt.utmSource || '—'} / {attempt.utmMedium || '—'} / {attempt.utmCampaign || '—'}</span>
                            ) : null}
                            {attempt.landingPath ? <span>Landing: {attempt.landingPath}</span> : null}
                            {attempt.referrerOrigin ? <span>Referrer: {attempt.referrerOrigin}{attempt.referrerPath ?? ''}</span> : null}
                          </div>
                        </div>
                        <div className="space-y-1 rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {attempt.user?.name || attempt.user?.email || 'Unknown user'}
                          </div>
                          <div className="break-all text-gray-500 dark:text-gray-400">User: {attempt.userId}</div>
                          {attempt.user?.email ? <div className="break-all text-gray-500 dark:text-gray-400">Email: {attempt.user.email}</div> : null}
                          {attempt.user?.createdAt ? <div className="text-gray-500 dark:text-gray-400">User since: {formatAdminDate(attempt.user.createdAt)}</div> : null}
                          <div className="break-all text-gray-500 dark:text-gray-400">Attempt: {attempt.id}</div>
                          {attempt.projectId ? <div className="break-all text-gray-500 dark:text-gray-400">Project: {attempt.projectId}</div> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleting(false);
          }
        }}
      >
        <DialogContent className="max-w-md" ariaDescription="Confirm deleting prank image or category">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === 'category'
                ? 'Delete category?'
                : deleteTarget?.kind === 'subcategory'
                  ? 'Delete subcategory?'
                  : 'Delete prank image?'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Confirm deleting the selected image prank record.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {deleteTarget
              ? `This will permanently delete "${deleteTarget.title}" and its stored files. This action cannot be undone.`
              : ''}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" className="cursor-pointer" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="cursor-pointer" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
