import { describe, expect, it } from "vitest";
import { FarmatodoAlgoliaConnector } from "@/features/retailers/infrastructure/connectors/farmatodo-algolia-connector";

describe("FarmatodoAlgoliaConnector", () => {
  it("queries Algolia index and maps offer price and store stock count", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              id: "116051491",
              objectID: "116051491",
              barcode: "7591002200145",
              mediaDescription: "Harina PAN Maíz Blanco Gluten Free 1 Kg",
              fullPrice: 1021,
              offerPrice: 950,
              stores_with_stock: [108, 113, 107],
              url: "116051491-harina-pan-maiz-blanco-gluten-free-1-kg",
            },
            {
              id: "999",
              objectID: "999",
              barcode: null,
              mediaDescription: "Arroz Blanco 1 Kg",
              fullPrice: 800,
              offerPrice: null,
              stores_with_stock: [],
              url: "999-arroz-blanco-1-kg",
            },
          ],
        }),
        { status: 200 }
      );

    const connector = new FarmatodoAlgoliaConnector({
      appId: "VCOJEYD2PO",
      apiKey: "test-key",
      indexName: "products-venezuela",
      fetchFn: mockFetch,
    });

    const hits = await connector.searchProducts("harina pan");
    expect(hits).toHaveLength(2);

    expect(hits[0].externalSku).toBe("116051491");
    expect(hits[0].originalAmount).toBe(950);
    expect(hits[0].originalCurrency).toBe("VES");
    expect(hits[0].inStock).toBe(true);
    expect(hits[0].storeAvailabilityCount).toBe(3);
    expect(hits[0].productUrl).toBe(
      "https://www.farmatodo.com.ve/producto/116051491-harina-pan-maiz-blanco-gluten-free-1-kg"
    );

    expect(hits[1].inStock).toBe(false);
    expect(hits[1].storeAvailabilityCount).toBe(0);
    expect(hits[1].originalAmount).toBe(800);
  });
});
