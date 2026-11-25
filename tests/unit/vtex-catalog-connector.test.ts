import { describe, expect, it, vi } from "vitest";
import { RetailerUpstreamError } from "@/features/retailers/domain/retailer-connector";
import { VtexCatalogConnector } from "@/features/retailers/infrastructure/connectors/vtex-catalog-connector";

describe("VtexCatalogConnector", () => {
  it("queries VTEX search with ?ft= and accepts HTTP 206 partial content", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        "https://www.locatel.com.ve/api/catalog_system/pub/products/search?ft=harina%20pan&_from=0&_to=11"
      );

      return new Response(
        JSON.stringify([
          {
            productId: "2099572",
            productName: "PAN HARINA MAIZ BLANCO 1KG",
            brand: "PAN",
            link: "https://www.locatel.com.ve/pan_harina_maiz_blanco_1kg/p",
            items: [
              {
                itemId: "2099572",
                nameComplete: "PAN HARINA MAIZ BLANCO 1KG",
                ean: "7591002000011",
                images: [
                  {
                    imageUrl:
                      "https://locatelvenezuela.vteximg.com.br/arquivos/ids/192280/2099572.jpg",
                  },
                ],
                sellers: [
                  {
                    sellerDefault: false,
                    commertialOffer: {
                      Price: 0,
                      IsAvailable: false,
                      AvailableQuantity: 0,
                    },
                  },
                  {
                    sellerDefault: true,
                    commertialOffer: {
                      Price: 1127.7,
                      ListPrice: 1127.7,
                      IsAvailable: true,
                      AvailableQuantity: 99999,
                    },
                  },
                ],
              },
            ],
          },
          {
            productId: "999",
            productName: "PRODUCTO SIN PRECIO",
            linkText: "producto-sin-precio",
            items: [
              {
                itemId: "999",
                sellers: [
                  {
                    sellerDefault: true,
                    commertialOffer: {
                      Price: 0,
                      IsAvailable: false,
                      AvailableQuantity: 0,
                    },
                  },
                ],
              },
            ],
          },
          {
            productId: "777",
            productName: "ACEITE VEGETAL VENEZOLANO 1L",
            linkText: "aceite-vegetal-venezolano-1l",
            items: [
              {
                itemId: "778",
                nameComplete: "ACEITE VEGETAL VENEZOLANO 1L",
                ean: "",
                sellers: [
                  {
                    sellerDefault: false,
                    commertialOffer: {
                      Price: 1950.5,
                      IsAvailable: false,
                      AvailableQuantity: 0,
                    },
                  },
                ],
              },
            ],
          },
        ]),
        {
          status: 206,
          headers: { "content-type": "application/json" },
        }
      );
    });

    const connector = new VtexCatalogConnector({
      retailerSlug: "locatel-caracas",
      baseUrl: "https://www.locatel.com.ve",
      region: "Caracas",
      currency: "VES",
      fetchFn,
    });

    const products = await connector.searchProducts("harina pan");

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      externalSku: "2099572",
      barcode: "7591002000011",
      rawTitle: "PAN HARINA MAIZ BLANCO 1KG",
      originalAmount: 1127.7,
      originalCurrency: "VES",
      inStock: true,
      storeAvailabilityCount: 99999,
      productUrl: "https://www.locatel.com.ve/pan_harina_maiz_blanco_1kg/p",
      imageUrl:
        "https://locatelvenezuela.vteximg.com.br/arquivos/ids/192280/2099572.jpg",
      region: "Caracas",
    });
    expect(products[1]).toMatchObject({
      externalSku: "778",
      barcode: null,
      rawTitle: "ACEITE VEGETAL VENEZOLANO 1L",
      originalAmount: 1950.5,
      originalCurrency: "VES",
      inStock: false,
      storeAvailabilityCount: 0,
      productUrl: "https://www.locatel.com.ve/aceite-vegetal-venezolano-1l/p",
      imageUrl: null,
      region: "Caracas",
    });
  });

  it("throws RetailerUpstreamError on HTTP failure", async () => {
    const fetchFn = vi.fn(
      async () => new Response("Scripts are not allowed!", { status: 400 })
    );

    const connector = new VtexCatalogConnector({
      retailerSlug: "locatel-caracas",
      baseUrl: "https://www.locatel.com.ve",
      region: "Caracas",
      currency: "VES",
      fetchFn,
    });

    await expect(connector.searchProducts("harina pan")).rejects.toBeInstanceOf(
      RetailerUpstreamError
    );
  });
});
