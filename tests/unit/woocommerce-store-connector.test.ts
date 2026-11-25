import { describe, expect, it } from "vitest";
import { RetailerUpstreamError } from "@/features/retailers/domain/retailer-connector";
import { WooCommerceStoreConnector } from "@/features/retailers/infrastructure/connectors/woocommerce-store-connector";

describe("WooCommerceStoreConnector", () => {
  it("parses Central Madeirense Maiquetia Store API v1 minor-unit products", async () => {
    const connector = new WooCommerceStoreConnector({
      retailerSlug: "central-madeirense",
      baseUrl: "https://tucentralonline.com/Maiquetia-53",
      region: "La Guaira",
      currency: "USD",
      fetchFn: async () =>
        new Response(
          JSON.stringify([
            {
              id: 23991,
              sku: "100904281",
              name: "Harina Pan Gluten Free 1Kg",
              permalink:
                "https://tucentralonline.com/Maiquetia-53/producto/harina-pan-gluten-free-1-kg/",
              is_in_stock: true,
              add_to_cart: { maximum: 120 },
              images: [],
              prices: {
                price: "109",
                currency_minor_unit: 2,
                currency_code: "BSD",
              },
            },
            {
              id: 27309,
              sku: "100906554",
              name: "Pollo La Caridad Congelado  KG",
              permalink:
                "https://tucentralonline.com/Maiquetia-53/producto/pollo-la-caridad-congelado-kg/",
              is_in_stock: true,
              add_to_cart: { maximum: 345 },
              images: [
                {
                  src: "https://tucentralonline.com/Maiquetia-53/wp-content/uploads/sites/26/2025/12/100906554.jpg",
                },
              ],
              prices: {
                price: "388",
                currency_minor_unit: 2,
                currency_code: "BSD",
              },
            },
          ]),
          { status: 200 }
        ),
    });

    const hits = await connector.searchProducts("harina");
    expect(hits).toHaveLength(2);

    expect(hits[0].externalSku).toBe("100904281");
    expect(hits[0].originalAmount).toBe(1.09);
    expect(hits[0].originalCurrency).toBe("USD");
    expect(hits[0].inStock).toBe(true);
    expect(hits[0].storeAvailabilityCount).toBe(120);
    expect(hits[0].region).toBe("La Guaira");

    expect(hits[1].externalSku).toBe("100906554");
    expect(hits[1].rawTitle).toBe("Pollo La Caridad Congelado KG");
    expect(hits[1].originalAmount).toBe(3.88);
    expect(hits[1].imageUrl).toBe(
      "https://tucentralonline.com/Maiquetia-53/wp-content/uploads/sites/26/2025/12/100906554.jpg"
    );
  });

  it("throws RetailerUpstreamError on non-200 HTTP response", async () => {
    const connector = new WooCommerceStoreConnector({
      retailerSlug: "central-madeirense",
      baseUrl: "https://tucentralonline.com/Maiquetia-53",
      region: "La Guaira",
      fetchFn: async () => new Response("Not Found", { status: 404 }),
    });

    await expect(connector.searchProducts("harina")).rejects.toBeInstanceOf(
      RetailerUpstreamError
    );
  });
});
