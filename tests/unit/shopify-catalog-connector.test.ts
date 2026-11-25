import { describe, expect, it } from "vitest";
import { RetailerUpstreamError } from "@/features/retailers/domain/retailer-connector";
import { ShopifyCatalogConnector } from "@/features/retailers/infrastructure/connectors/shopify-catalog-connector";

describe("ShopifyCatalogConnector", () => {
  it("picks Detal variant over wholesale caja, skips bulk-only items, and caches catalog", async () => {
    let fetchCount = 0;
    const connector = new ShopifyCatalogConnector({
      retailerSlug: "puntoalmayor-la-guaira",
      baseUrl: "https://puntoalmayor.com",
      region: "La Guaira",
      fetchFn: async () => {
        fetchCount += 1;
        return new Response(
          JSON.stringify({
            products: [
              {
                id: 8704466190556,
                title: "Aceite de Girasol Mi Cocinero 900ml",
                handle: "aceite-de-girasol-mi-cocinero-900ml",
                images: [{ src: "https://cdn.shopify.com/aceite.jpg" }],
                variants: [
                  {
                    id: 45559808491740,
                    title: "Al Mayor (Caja) 20 unidades",
                    sku: "",
                    available: true,
                    price: "84.99",
                  },
                  {
                    id: 45559802233052,
                    title: "Detal",
                    sku: "",
                    available: true,
                    price: "4.49",
                  },
                ],
              },
              {
                id: 9001,
                title: "Bulto de arroz Premium Mary 900gr",
                handle: "bulto-arroz-mary",
                variants: [
                  {
                    id: 90011,
                    title: "mayor",
                    available: true,
                    price: "79.15",
                  },
                ],
              },
              {
                id: 9002,
                title: "BULTO DE HARINA DE TRIGO MARY TODO USO",
                handle: "bulto-harina-trigo-mary",
                variants: [
                  {
                    id: 90021,
                    title: "Default Title",
                    available: true,
                    price: "23.80",
                  },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      },
    });

    const oilHits = await connector.searchProducts("aceite");
    expect(oilHits).toHaveLength(1);
    expect(oilHits[0].originalAmount).toBe(4.49);
    expect(oilHits[0].originalCurrency).toBe("USD");
    expect(oilHits[0].externalSku).toBe("45559802233052");
    expect(oilHits[0].productUrl).toBe(
      "https://puntoalmayor.com/products/aceite-de-girasol-mi-cocinero-900ml"
    );

    const riceHits = await connector.searchProducts("arroz");
    expect(riceHits).toStrictEqual([]);

    const wheatHits = await connector.searchProducts("harina de trigo");
    expect(wheatHits).toStrictEqual([]);

    // Catalog was fetched once and reused across all 3 queries
    expect(fetchCount).toBe(1);
  });

  it("throws RetailerUpstreamError on non-200 HTTP response", async () => {
    const connector = new ShopifyCatalogConnector({
      retailerSlug: "puntoalmayor-la-guaira",
      baseUrl: "https://puntoalmayor.com",
      region: "La Guaira",
      fetchFn: async () => new Response("Internal Error", { status: 500 }),
    });

    await expect(connector.searchProducts("harina")).rejects.toBeInstanceOf(
      RetailerUpstreamError
    );
  });
});
