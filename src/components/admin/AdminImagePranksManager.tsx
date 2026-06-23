"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Images, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

type Item = {
  id: string;
  categoryId: string;
  slug: string;
  titleEn: string;
  descriptionEn: string | null;
  previewImageUrl: string | null;
  isPublic: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
};

const emptyCategoryForm = {
  slug: '',
  title: '',
  subtitle: '',
  priority: '0',
  isActive: true,
};

const emptyItemForm = {
  categoryId: '',
  slug: '',
  title: '',
  description: '',
  searchText: '',
  priority: '0',
  isPublic: false,
};

export function AdminImagePranksManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [itemImagePreviewUrl, setItemImagePreviewUrl] = useState<string | null>(null);
  const [editingItemPreviewUrl, setEditingItemPreviewUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pranks');

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === itemForm.categoryId) ?? null,
    [categories, itemForm.categoryId],
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [categoryResult, itemResult] = await Promise.all([
        Api.adminImagePrankCategoriesList(),
        Api.adminImagePranksList({ q: query, categoryId: categoryFilter || null, page: 1, pageSize: 100 }),
      ]);
      setCategories(categoryResult.items);
      setItems(itemResult.items as Item[]);
      setItemForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || categoryResult.items[0]?.id || '',
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const editItem = (item: Item) => {
    setActiveTab('pranks');
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.categoryId,
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
    setItemForm({ ...emptyItemForm, categoryId: categories[0]?.id ?? '' });
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pranks" className="cursor-pointer">Prank images</TabsTrigger>
          <TabsTrigger value="categories" className="cursor-pointer">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="pranks" className="space-y-4">
          <Card>
          <CardHeader>
            <CardTitle>{editingItemId ? 'Edit prank image' : 'New prank image'}</CardTitle>
            <CardDescription>Public images appear after Custom mix in the catalog.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 lg:grid-cols-2" onSubmit={submitItem}>
              <div className="space-y-1.5">
                <Label htmlFor="prank-item-category">Category</Label>
                <select
                  id="prank-item-category"
                  className="h-10 w-full cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                  value={itemForm.categoryId}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.titleEn}</option>
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
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="prank-item-description">Description</Label>
                <Textarea id="prank-item-description" value={itemForm.description} onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prank-item-search">Keywords</Label>
                <Input id="prank-item-search" value={itemForm.searchText} onChange={(event) => setItemForm((prev) => ({ ...prev, searchText: event.target.value }))} />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Extra keywords, aliases, and phrases used only for catalog search.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prank-item-image">Image</Label>
                <Input id="prank-item-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setItemImage(event.target.files?.[0] ?? null)} />
                {displayedItemImagePreviewUrl ? (
                  <div className="mt-2 flex items-center gap-3 rounded-md border border-gray-200 p-2 dark:border-gray-800">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={displayedItemImagePreviewUrl} alt="Selected prank preview" className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">{itemImage ? 'Selected image preview' : 'Current image'}</div>
                      {itemImage ? (
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{itemImage.name}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
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
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pranks" />
                <select
                  className="h-10 cursor-pointer rounded-md border border-gray-200 bg-background px-3 text-sm dark:border-gray-800"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.titleEn}</option>
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
                    <div key={item.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900">
                        {item.previewImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewImageUrl} alt={item.titleEn} className="h-full w-full object-cover" />
                        ) : (
                          <Images className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-semibold">{item.titleEn}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{item.category?.titleEn ?? 'No category'} / {item.slug}</div>
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
                            onClick={async () => {
                              await Api.adminImagePrankDelete(item.id, { deleteFiles: true });
                              await loadAll();
                            }}
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
                          onClick={async () => {
                            await Api.adminImagePrankCategoriesDelete(category.id, { deleteFiles: true });
                            await loadAll();
                          }}
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
      </Tabs>
    </div>
  );
}
