# Image Prank Character Generation

This doc describes how to create real raster character images for the Image Prank catalog.

## Goal

Image Prank catalog characters are full-body isolated people or objects that can be mixed into a user target image. They must be real generated bitmap images, not SVGs, placeholders, CSS drawings, or manually mocked assets.

## Storage Layout

Store source data under:

```text
/Users/test/Downloads/pranks-data/<Category>/<Subcategory>/<item-slug>/
```

For the main human catalog, examples are:

```text
/Users/test/Downloads/pranks-data/Main/Women/woman-paula-simple/
/Users/test/Downloads/pranks-data/Main/Men/man-paul-simple/
/Users/test/Downloads/pranks-data/Main/Homeless People/homeless-rufus/
```

Each item directory should contain:

```text
image.png
image.json
metadata.json
```

`image.png` is the high-quality generated original. `image.json` is the generator report. `metadata.json` is used for import/re-import.

## Generator

Use the local character generator:

```bash
cd /Users/test/web/yumcut-characters
npm run character:new -- \
  --prompt "<character description>" \
  --prompt-file /Users/test/web/app.yumcut.com/scripts/pranks/prompts/simple-adult-white.md \
  --style-file scripts/character-new/prompts/styles/brainrot-adult.md \
  --guide-image scripts/character-new/prompts/safezone-template-9x16.png \
  --output "/Users/test/Downloads/pranks-data/Main/Men/man-paul-simple/image.png" \
  --model gpt-5.4 \
  --quality high \
  --include-cost=true \
  --include-report=true
```

Use prompt files from `scripts/pranks/prompts/`:

- `simple-adult-white.md`: normal everyday adult humans.
- `eccentric-street-white.md`: eccentric disheveled street characters for the Homeless subcategory.
- `realistic-human-white.md`: general adult human prompt, but avoid it when the user asks for plain/non-glamorous people because it permits more attractive styling.

For kids, create or use a kid-specific prompt. Do not use adult-only prompts for children.

## Prompt Requirements

Prompts should describe exactly one catalog subject:

- One full-body character.
- Pure white background.
- Head-to-toe visible.
- Neutral pose.
- Clean silhouette for compositing.
- No text, logos, watermarks, UI, frames, or readable writing.
- No environment, floor, shadows, gradients, props that break catalog use, or background scene.
- Public-safe clothing and styling.

For ordinary people, explicitly ask for simple everyday styling and avoid glamour, model-like posing, body focus, or fashion-editorial styling.

Example:

```text
Paul, an ordinary adult man with short brown hair, plain gray zip hoodie over a white t-shirt, regular blue jeans, comfortable sneakers, natural face, average build, relaxed neutral expression, everyday casual style
```

## Metadata

Write `metadata.json` with the final item priority. Priority controls user-facing order and should be preserved for re-import.

Example:

```json
{
  "categorySlug": "main",
  "categoryTitle": "Main",
  "slug": "man-paul-simple",
  "title": "Paul",
  "description": "Full-body realistic simple everyday man character on a white background for Image Prank catalog mixing.",
  "searchText": "adult man simple everyday casual gray hoodie jeans full body white background public safe",
  "priority": 330,
  "isPublic": true,
  "subcategorySlug": "men",
  "subcategoryTitle": "Men",
  "categoryPriority": 0,
  "subcategoryPriority": 199
}
```

## Priorities

Use higher priorities for items that should appear first in the user catalog.

Current examples:

- Normal Women: `330..321`.
- Normal Men: `330..321`.
- Eccentric Homeless: `116..111`.

Keep existing items below new higher-priority sets unless the user asks to remove or demote them.

## Importing To The Site

Use the same storage behavior as the admin upload:

1. Upload the high-quality `image.png` to the storage service as a character image.
2. Generate the `catalog-preview` variant with height `896`.
3. Create or update `ImagePrankItem` with:
   - original `imagePath` / `imageUrl`
   - preview `previewImagePath` / `previewImageUrl`
   - category and subcategory IDs
   - title, search text, priority, and `isPublic: true`

The local storage service is normally:

```text
http://localhost:3333
```

The app catalog page is normally:

```text
http://localhost:3001/?openMode=image-prank&category=main&subcategory=<subcategory-slug>
```

## Visual QA

Before importing, create a contact sheet and inspect it:

```bash
magick montage \
  "/Users/test/Downloads/pranks-data/Main/Men/man-paul-simple/image.png" \
  "/Users/test/Downloads/pranks-data/Main/Men/man-martin-simple/image.png" \
  -thumbnail 220x390 \
  -background white \
  -geometry 240x410+10+10 \
  -tile 5x2 \
  /tmp/simple-men-sheet.png
```

Reject or regenerate items that are:

- Not full-body.
- Too attractive when the user asked for normal/plain people.
- Too clean or polished for Homeless/eccentric street characters.
- Not isolated on white.
- Cropped, shadowed, unreadable, or obviously fake.

After importing, verify the web page with Chrome MCP:

```text
http://localhost:3001/?openMode=image-prank&category=main&subcategory=men
```

Check that the new items appear in the expected priority order and that preview images load.
