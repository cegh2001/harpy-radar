import { describe, expect, it } from "vitest";
import { StellarWebstoreConnector } from "@/features/retailers/infrastructure/connectors/stellar-webstore-connector";

describe("StellarWebstoreConnector", () => {
  it("bootstraps session cookie once and parses Bahia JSON products", async () => {
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const headers = new Headers(init?.headers);
      calls.push({ url, cookie: headers.get("Cookie") });

      if (url === "https://store.bahiasupermarket.com/") {
        return new Response("<html></html>", {
          status: 200,
          headers: { "set-cookie": "PHPSESSID=abc123; path=/" },
        });
      }

      if (url.includes("des=harina")) {
        return new Response(
          JSON.stringify([
            {
              product: "Harina de maiz blanco pan 1kg",
              precio: 1.43,
              impuesto: "0",
              code: "000205",
              Image: "./DB-IMG-PRODUCT/000205/ImgThumb.jpg",
              Simbolo: "$",
              PrecioFinal: 1.43,
            },
          ]),
          { status: 200 }
        );
      }

      return new Response("No hay resultados disponibles", { status: 200 });
    };

    const connector = new StellarWebstoreConnector({
      retailerSlug: "bahia-la-guaira",
      baseUrl: "https://store.bahiasupermarket.com",
      region: "La Guaira",
      fetchFn: mockFetch,
    });

    const hits = await connector.searchProducts("harina");
    expect(hits).toHaveLength(1);
    expect(hits[0].externalSku).toBe("000205");
    expect(hits[0].originalAmount).toBe(1.43);
    expect(hits[0].originalCurrency).toBe("USD");
    expect(hits[0].region).toBe("La Guaira");
    expect(hits[0].imageUrl).toBe(
      "https://store.bahiasupermarket.com/DB-IMG-PRODUCT/000205/ImgThumb.jpg"
    );

    const emptyHits = await connector.searchProducts("inexistente");
    expect(emptyHits).toStrictEqual([]);

    // Session cookie was fetched once and reused on subsequent calls
    expect(calls).toHaveLength(3);
    expect(calls[1].cookie).toBe("PHPSESSID=abc123");
    expect(calls[2].cookie).toBe("PHPSESSID=abc123");
  });
});
