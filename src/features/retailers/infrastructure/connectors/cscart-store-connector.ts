import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  Uuml: "Ü",
};

export interface CsCartLocationConfig {
  country: string;
  state: string;
  stateText: string;
  city: string;
}

export interface CsCartStoreConnectorOptions {
  retailerSlug: string;
  baseUrl: string;
  region: string;
  currency?: "USD" | "VES";
  location?: CsCartLocationConfig;
  fetchFn?: typeof fetch;
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => {
      return NAMED_HTML_ENTITIES[name] ?? full;
    });
}

function parseCsCartPrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const decimals = cleaned.length - lastComma - 1;
    normalized =
      decimals >= 1 && decimals <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveUrl(rawUrl: string | null, baseUrl: string): string {
  if (!rawUrl) return `${baseUrl}/`;
  try {
    return new URL(rawUrl, `${baseUrl}/`).toString();
  } catch {
    return `${baseUrl}/`;
  }
}

function extractTitleAndUrl(
  formHtml: string,
  baseUrl: string
): { rawTitle: string; productUrl: string } | null {
  const anchorMatch = formHtml.match(
    /<a\b([^>]*\bclass="[^"]*\bproduct-title\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/i
  );
  if (!anchorMatch) return null;

  const attrs = anchorMatch[1] ?? "";
  const innerHtml = anchorMatch[2] ?? "";
  const hrefMatch = attrs.match(/\bhref="([^"]+)"/i);
  const titleAttrMatch = attrs.match(/\btitle="([^"]+)"/i);

  const rawText =
    titleAttrMatch?.[1] ?? innerHtml.replace(/<[^>]+>/g, " ").trim();
  const rawTitle = decodeHtmlEntities(rawText).replace(/\s+/g, " ").trim();
  if (!rawTitle) return null;

  const productUrl = resolveUrl(
    hrefMatch?.[1] ? decodeHtmlEntities(hrefMatch[1]) : null,
    baseUrl
  );

  return { rawTitle, productUrl };
}

function extractImageUrl(
  formHtml: string,
  productId: string,
  baseUrl: string
): string | null {
  const imgMatch = formHtml.match(
    new RegExp(`<img\\b[^>]*\\bid="det_img_${productId}"[^>]*>`, "i")
  );
  if (!imgMatch) return null;

  const srcMatch = imgMatch[0].match(/\bsrc="([^"]+)"/i);
  if (!srcMatch?.[1]) return null;
  return resolveUrl(decodeHtmlEntities(srcMatch[1]), baseUrl);
}

function extractPrice(formHtml: string, productId: string): number | null {
  const discountedMatch = formHtml.match(
    new RegExp(`id="sec_discounted_price_${productId}"[^>]*>([^<]+)<`, "i")
  );
  const baseMatch =
    discountedMatch ??
    formHtml.match(
      new RegExp(`id="sec_price_${productId}"[^>]*>([^<]+)<`, "i")
    );
  if (!baseMatch?.[1]) return null;
  return parseCsCartPrice(decodeHtmlEntities(baseMatch[1]));
}

export function parseCsCartSearchHtml(
  html: string,
  baseUrl: string,
  currency: "USD" | "VES",
  region: string,
  observedAt: Date
): RawRetailProduct[] {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const formRegex =
    /<form\b[^>]*name="product_form_(\d+)"[^>]*>([\s\S]*?)<\/form>/gi;

  const seenIds = new Set<string>();
  const products: RawRetailProduct[] = [];

  for (const match of html.matchAll(formRegex)) {
    const productId = match[1];
    const formHtml = match[2];
    if (!productId || !formHtml || seenIds.has(productId)) continue;
    seenIds.add(productId);

    const meta = extractTitleAndUrl(formHtml, normalizedBaseUrl);
    const amount = extractPrice(formHtml, productId);
    if (!meta || amount === null) continue;

    const hasAddButton =
      formHtml.includes(`button_cart_${productId}`) ||
      formHtml.includes(`dispatch[checkout.add..${productId}]`);
    const markedOutOfStock = /\b(?:out-of-stock|agotado)\b/i.test(formHtml);

    products.push({
      externalSku: productId,
      barcode: null,
      rawTitle: meta.rawTitle,
      originalAmount: amount,
      originalCurrency: currency,
      inStock: hasAddButton && !markedOutOfStock,
      storeAvailabilityCount: null,
      productUrl: meta.productUrl,
      imageUrl: extractImageUrl(formHtml, productId, normalizedBaseUrl),
      region,
      observedAt,
    });
  }

  return products;
}

function mergeCookiesFromHeaders(
  headers: Headers,
  jar: Map<string, string>
): void {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const rawList =
    typeof headersWithGetSetCookie.getSetCookie === "function"
      ? headersWithGetSetCookie.getSetCookie()
      : [];

  const cookieStrings =
    rawList.length > 0
      ? rawList
      : (() => {
          const single = headers.get("set-cookie");
          return single ? single.split(/,\s*(?=[^;=]+=)/) : [];
        })();

  for (const rawCookie of cookieStrings) {
    const firstPart = rawCookie.split(";")[0]?.trim();
    if (!firstPart) continue;
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex <= 0) continue;
    const name = firstPart.slice(0, eqIndex).trim();
    const value = firstPart.slice(eqIndex + 1).trim();
    if (name) {
      jar.set(name, value);
    }
  }
}

function serializeCookieJar(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export class CsCartStoreConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly region: string;
  private readonly currency: "USD" | "VES";
  private readonly location?: CsCartLocationConfig;
  private readonly fetchFn: typeof fetch;
  private sessionPromise: Promise<string> | null = null;

  constructor(options: CsCartStoreConnectorOptions) {
    this.retailerSlug = options.retailerSlug;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.region = options.region;
    this.currency = options.currency ?? "USD";
    this.location = options.location;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async bootstrapSession(signal?: AbortSignal): Promise<string> {
    const cookieJar = new Map<string, string>();
    const homeResponse = await this.fetchFn(`${this.baseUrl}/`, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal,
    });

    if (!homeResponse.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        homeResponse.status,
        `CS-Cart storefront returned HTTP ${homeResponse.status}`
      );
    }

    mergeCookiesFromHeaders(homeResponse.headers, cookieJar);

    if (this.location) {
      const cookieHeader = serializeCookieJar(cookieJar);
      const body = new URLSearchParams({
        "location[country]": this.location.country,
        "location[state]": this.location.state,
        "location[state_text]": this.location.stateText,
        "location[city]": this.location.city,
        "location[locality]": this.location.city,
        "location[locality_text]": this.location.city,
        "location[place_id]": "",
        is_ajax: "1",
      });

      const locationResponse = await this.fetchFn(
        `${this.baseUrl}/index.php?dispatch=geo_maps.set_location`,
        {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body,
          signal,
        }
      );

      if (!locationResponse.ok) {
        throw new RetailerUpstreamError(
          this.retailerSlug,
          locationResponse.status,
          `CS-Cart location endpoint returned HTTP ${locationResponse.status}`
        );
      }

      mergeCookiesFromHeaders(locationResponse.headers, cookieJar);
    }

    return serializeCookieJar(cookieJar);
  }

  private async ensureSessionCookie(signal?: AbortSignal): Promise<string> {
    if (!this.sessionPromise) {
      this.sessionPromise = this.bootstrapSession(signal).catch((error) => {
        this.sessionPromise = null;
        throw error;
      });
    }
    return this.sessionPromise;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const cookieHeader = await this.ensureSessionCookie(signal);
    const searchUrl = `${this.baseUrl}/?match=all&subcats=Y&pcode_from_q=Y&pshort=Y&pfull=Y&pname=Y&pkeywords=Y&search_performed=Y&q=${encodeURIComponent(query)}&dispatch=products.search&currency=${this.currency}`;

    const response = await this.fetchFn(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `CS-Cart search returned HTTP ${response.status}`
      );
    }

    const html = await response.text();
    return parseCsCartSearchHtml(
      html,
      this.baseUrl,
      this.currency,
      this.region,
      new Date()
    );
  }
}
