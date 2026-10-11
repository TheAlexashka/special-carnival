import type { BookMetadata, PageInfo } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

interface MuseumDigitalImage {
  quell_id?: number;
  name?: string;
  order?: number;
  folder?: string;
  filename_loc?: string;
  owner?: string;
  creator?: string;
  rights?: string;
  preview?: string;
}

interface MuseumDigitalObject {
  object_id?: number;
  object_inventory_number?: string;
  object_type?: string;
  object_name?: string;
  object_description?: string;
  object_material_technique?: string;
  object_dimensions?: string;
  object_institution?: { institution_id?: number; institution_name?: string };
  object_collection?: Array<{ collection_id?: number; collection_name?: string }>;
  object_images?: MuseumDigitalImage[];
}

function secureUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.replace(/\\\//g, "/"));
    if (url.protocol === "http:") url.protocol = "https:";
    return url.toString();
  } catch {
    return undefined;
  }
}

function assetUrl(host: string, folder: string | undefined, preview: string | undefined, width: 200 | 500): string | undefined {
  if (!folder || !preview) return undefined;
  // API gives 200w_hash.jpg; museum-digital also provides a 500w derivative.
  const filename = preview.replace(/^\d+w_/, `${width}w_`);
  return `https://assets.museum-digital.org/${host}/${folder.replace(/^\/+/, "")}/${filename}`;
}

/**
 * museum-digital (all regional instances, e.g. bawue.museum-digital.de).
 *
 * The official /json/object/{id} endpoint returns every public image, its
 * source URL and its rights label. For object 148546 the two source images are
 * marked Public Domain and filename_loc resolves to real HTTPS JPEGs.
 *
 * We prefer filename_loc (original), use the public 500w derivative as HD
 * fallback and 200w as thumbnail/mobile. This is more reliable than the IIIF
 * endpoint which currently intermittently answers 200 with an empty body.
 */
export async function parseMuseumDigitalUrl(rawUrl: string): Promise<BookMetadata> {
  const cleanUrl = rawUrl.split("#")[0].trim();
  const parsed = new URL(cleanUrl);
  const idMatch = parsed.pathname.match(/\/object\/(\d+)/i) || parsed.search.match(/(?:oges|object_id)=(\d+)/i);
  if (!idMatch) throw new Error("Нужна ссылка на объект museum-digital вида /object/148546.");

  const id = idMatch[1];
  const instance = parsed.hostname.split(".")[0];
  const jsonUrl = `${parsed.origin}/json/object/${id}`;
  const response = await fetch(jsonUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`museum-digital JSON API ответил HTTP ${response.status}`);

  const data = (await response.json()) as MuseumDigitalObject;
  const images = (data.object_images || []).filter((image) => image.preview || image.filename_loc);
  if (!images.length) throw new Error("В карточке museum-digital нет опубликованных изображений.");

  const pages: PageInfo[] = images.map((image, index) => {
    const thumbnail = assetUrl(instance, image.folder, image.preview, 200);
    const hd = assetUrl(instance, image.folder, image.preview, 500);
    const original = secureUrl(image.filename_loc) || hd || thumbnail || "";
    return {
      index: index + 1,
      id: image.quell_id || `${id}-${index + 1}`,
      label: image.name || `Изображение ${index + 1}`,
      thumbnailUrl: thumbnail || hd || original,
      originalUrl: original,
      hdUrl: original || hd || thumbnail || "",
      mobileUrl: hd || thumbnail || original,
    };
  });

  const rights = [...new Set(images.map((image) => image.rights).filter(Boolean))].join("; ");
  const owners = [...new Set(images.map((image) => image.owner).filter(Boolean))].join("; ");
  const creators = [...new Set(images.map((image) => image.creator).filter(Boolean))].join("; ");
  const collections = (data.object_collection || []).map((item) => item.collection_name).filter(Boolean).join("; ");
  const details = [
    data.object_description,
    data.object_material_technique ? `Материал / техника: ${data.object_material_technique}` : "",
    data.object_dimensions ? `Размер: ${data.object_dimensions}` : "",
    rights ? `Права на изображения: ${rights}` : "",
    owners ? `Источник: ${owners}` : "",
    collections ? `Коллекции: ${collections}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    url: cleanUrl,
    libraryType: "museumdigital",
    libraryName: `museum-digital${data.object_institution?.institution_name ? ` — ${data.object_institution.institution_name}` : ""}`,
    title: data.object_name || `museum-digital object ${id}`,
    author: creators || undefined,
    description: details || undefined,
    coverUrl: pages[0]?.thumbnailUrl,
    totalPages: pages.length,
    pages,
    metaRaw: {
      objectId: Number(id),
      inventoryNumber: data.object_inventory_number || null,
      objectType: data.object_type || null,
      institution: data.object_institution || null,
      rights: rights || null,
      jsonUrl,
      source: `${parsed.hostname} / museum-digital`,
    },
  };
}
