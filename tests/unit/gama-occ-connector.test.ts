import { describe, expect, it } from "vitest";
import { RetailerUpstreamError } from "@/features/retailers/domain/retailer-connector";
import { GamaOccConnector } from "@/features/retailers/infrastructure/connectors/gama-occ-connector";

describe("GamaOccConnector", () => {
  it("maps valid OCC products and surfaces typed upstream errors on 400", async () => {
    const okConnector = new GamaOccConnector({
      warehouseCode: "S007",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            products: [
              {
                code: "10023",
                name: "Harina de Maíz Blanco P.A.N. 1Kg",
                url: "/p/10023",
                price: { value: 1280, currencyIso: "VES" },
                totalWithVatPrice: { value: 1280 },
                stock: { stockLevelStatus: "inStock", stockLevel: 24 },
              },
            ],
          }),
          { status: 200 }
        ),
    });

    const hits = await okConnector.searchProducts("harina");
    expect(hits).toHaveLength(1);
    expect(hits[0].externalSku).toBe("10023");
    expect(hits[0].originalCurrency).toBe("VES");
    expect(hits[0].inStock).toBe(true);

    const errConnector = new GamaOccConnector({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            errors: [{ type: "NullPointerError" }],
          }),
          { status: 400 }
        ),
    });

    await expect(errConnector.searchProducts("harina")).rejects.toBeInstanceOf(
      RetailerUpstreamError
    );
  });
});
