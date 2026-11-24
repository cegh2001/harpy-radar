import { describe, expect, it } from "vitest";
import { RetailerUpstreamError } from "@/features/retailers/domain/retailer-connector";
import { RioMarketConnector } from "@/features/retailers/infrastructure/connectors/riomarket-connector";

describe("RioMarketConnector", () => {
  it("extracts escaped Next.js RSC product JSON and normalizes KG items", async () => {
    const htmlFixture = `
      <script>self.__next_f.push([1,"{\"product\":{\"name\":\"Pollo Entero Congelado\",\"price\":3.6207,\"photosUrl\":[\"https://d6ev5cgx8awe7.cloudfront.net/ECOMMERCE1/22212.webp\"],\"unit\":\"KG\",\"sku\":\"22212\",\"ean\":[\"2022212000000\"],\"stock\":856,\"isAvailable\":true,\"slug\":\"pollo-entero-congelado-22212\"}}"])</script>
      <script>self.__next_f.push([1,"{\"product\":{\"name\":\"Harina de Maíz Blanco sin Gluten Pan 1 Kg\",\"price\":1.2785,\"photosUrl\":[\"https://d6ev5cgx8awe7.cloudfront.net/ECOMMERCE/7591002200145.webp\"],\"unit\":\"UNIDAD\",\"sku\":\"7591002200145\",\"ean\":[\"7591002200145\"],\"stock\":120,\"isAvailable\":true,\"slug\":\"harina-pan-1kg\"}}"])</script>
    `;

    const connector = new RioMarketConnector({
      fetchFn: async () => new Response(htmlFixture, { status: 200 }),
    });

    const hits = await connector.searchProducts("pollo");
    expect(hits).toHaveLength(2);

    expect(hits[0].externalSku).toBe("22212");
    expect(hits[0].rawTitle).toBe("Pollo Entero Congelado 1kg");
    expect(hits[0].originalAmount).toBe(3.6207);
    expect(hits[0].originalCurrency).toBe("USD");
    expect(hits[0].region).toBe("Caracas");
    expect(hits[0].inStock).toBe(true);

    expect(hits[1].externalSku).toBe("7591002200145");
    expect(hits[1].rawTitle).toBe("Harina de Maíz Blanco sin Gluten Pan 1 Kg");
    expect(hits[1].barcode).toBe("7591002200145");
    expect(hits[1].productUrl).toBe(
      "https://www.riomarket.com/product/harina-pan-1kg"
    );
  });

  it("throws RetailerUpstreamError on non-200 response", async () => {
    const connector = new RioMarketConnector({
      fetchFn: async () => new Response("Service Unavailable", { status: 503 }),
    });

    await expect(connector.searchProducts("harina")).rejects.toBeInstanceOf(
      RetailerUpstreamError
    );
  });
});
