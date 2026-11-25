import { describe, expect, it, vi } from "vitest";
import { RetailerUpstreamError } from "@/features/retailers/domain/retailer-connector";
import { CsCartStoreConnector } from "@/features/retailers/infrastructure/connectors/cscart-store-connector";

const SAMPLE_VIVA_HTML = `
  <div class="ty-grid-list__item">
    <form action="https://vivaenlinea.com/" method="post" name="product_form_12912">
      <div class="ty-grid-list__image">
        <a href="https://vivaenlinea.com/alimentos/viveres/harinas-y-mezclas/harina-de-maiz-pan-1-kg/">
          <img id="det_img_12912" src="/images/thumbnails/200/200/detailed/17/pan.png" />
        </a>
      </div>
      <div class="ty-grid-list__item-name">
        <a href="https://vivaenlinea.com/alimentos/viveres/harinas-y-mezclas/harina-de-maiz-pan-1-kg/" class="product-title" title="Harina De Ma&iacute;z Pan 1 Kg">Harina De Ma&iacute;z Pan 1 Kg</a>
      </div>
      <div class="ty-grid-list__price">
        <span class="ty-price" id="line_discounted_price_12912"><span id="sec_discounted_price_12912" class="ty-price-num">1.21</span></span>
      </div>
      <button id="button_cart_12912" type="submit" name="dispatch[checkout.add..12912]">Añadir</button>
    </form>
  </div>
  <div class="ty-grid-list__item">
    <form action="https://vivaenlinea.com/" method="post" name="product_form_12912">
      <a href="/duplicate" class="product-title" title="Duplicate Harina">Duplicate Harina</a>
      <span id="sec_discounted_price_12912">99.99</span>
    </form>
  </div>
  <div class="ty-grid-list__item">
    <form action="https://vivaenlinea.com/" method="post" name="product_form_13780">
      <a href="/pollo-entero-san-blas/" class="product-title">Pollo Entero San Blas 1.80 Kg</a>
      <span id="sec_discounted_price_13780">5.58</span>
    </form>
  </div>
  <div class="ty-grid-list__item">
    <form action="https://vivaenlinea.com/" method="post" name="product_form_99999">
      <a href="/sin-precio/" class="product-title">Producto Sin Precio</a>
      <span id="sec_discounted_price_99999">0.00</span>
    </form>
  </div>
`;

describe("CsCartStoreConnector", () => {
  it("bootstraps La Guaira session cookies once and parses Viva product cards", async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "https://vivaenlinea.com/") {
          return new Response("<html>ok</html>", {
            status: 200,
            headers: {
              "set-cookie": "sid_customer_s_7f7a5=abc123-C; path=/; HttpOnly",
            },
          });
        }

        if (url.includes("dispatch=geo_maps.set_location")) {
          const headers = new Headers(init?.headers);
          expect(headers.get("Cookie")).toBe("sid_customer_s_7f7a5=abc123-C");
          expect(String(init?.body)).toContain("location%5Bcity%5D=La+Guaira");
          return new Response(JSON.stringify({ city: "La Guaira" }), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "set-cookie": "viva_branch=lg; path=/",
            },
          });
        }

        const headers = new Headers(init?.headers);
        expect(headers.get("Cookie")).toBe(
          "sid_customer_s_7f7a5=abc123-C; viva_branch=lg"
        );
        return new Response(SAMPLE_VIVA_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
    );

    const connector = new CsCartStoreConnector({
      retailerSlug: "viva-la-guaira",
      baseUrl: "https://vivaenlinea.com",
      region: "La Guaira",
      currency: "USD",
      location: {
        country: "VE",
        state: "VE-X",
        stateText: "La Guaira",
        city: "La Guaira",
      },
      fetchFn,
    });

    const first = await connector.searchProducts("harina pan");
    const second = await connector.searchProducts("pollo");

    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(second).toHaveLength(2);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      externalSku: "12912",
      barcode: null,
      rawTitle: "Harina De Maíz Pan 1 Kg",
      originalAmount: 1.21,
      originalCurrency: "USD",
      inStock: true,
      storeAvailabilityCount: null,
      productUrl:
        "https://vivaenlinea.com/alimentos/viveres/harinas-y-mezclas/harina-de-maiz-pan-1-kg/",
      imageUrl:
        "https://vivaenlinea.com/images/thumbnails/200/200/detailed/17/pan.png",
      region: "La Guaira",
    });
    expect(first[1]).toMatchObject({
      externalSku: "13780",
      rawTitle: "Pollo Entero San Blas 1.80 Kg",
      originalAmount: 5.58,
      inStock: false,
      productUrl: "https://vivaenlinea.com/pollo-entero-san-blas/",
      imageUrl: null,
    });
  });

  it("resets failed session bootstrap and recovers on subsequent search", async () => {
    let attempt = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      attempt += 1;
      if (attempt === 1) {
        return new Response("upstream error", { status: 503 });
      }
      if (url === "https://vivaenlinea.com/") {
        return new Response("<html>ok</html>", { status: 200 });
      }
      return new Response("<html></html>", { status: 200 });
    });

    const connector = new CsCartStoreConnector({
      retailerSlug: "viva-la-guaira",
      baseUrl: "https://vivaenlinea.com",
      region: "La Guaira",
      fetchFn,
    });

    await expect(connector.searchProducts("arroz")).rejects.toBeInstanceOf(
      RetailerUpstreamError
    );

    const retryResults = await connector.searchProducts("arroz");
    expect(retryResults).toEqual([]);
  });
});
