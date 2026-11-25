import { env } from "@/shared/config/env";
import type { RetailerConnector } from "../../domain/retailer-connector";
import { CsCartStoreConnector } from "./cscart-store-connector";
import { FarmatodoAlgoliaConnector } from "./farmatodo-algolia-connector";
import { GamaOccConnector } from "./gama-occ-connector";
import { RioMarketConnector } from "./riomarket-connector";
import { ShopifyCatalogConnector } from "./shopify-catalog-connector";
import { StellarWebstoreConnector } from "./stellar-webstore-connector";
import { VtexCatalogConnector } from "./vtex-catalog-connector";
import { WooCommerceStoreConnector } from "./woocommerce-store-connector";

export function createRetailerConnector(
  retailerSlug: string
): RetailerConnector | null {
  switch (retailerSlug) {
    case "bahia-la-guaira":
      if (!env.SOURCE_BAHIA_ENABLED) return null;
      return new StellarWebstoreConnector({
        retailerSlug: "bahia-la-guaira",
        baseUrl: "https://store.bahiasupermarket.com",
        region: "La Guaira",
      });
    case "riomarket-caracas":
      if (!env.SOURCE_RIOMARKET_ENABLED) return null;
      return new RioMarketConnector({
        retailerSlug: "riomarket-caracas",
        region: "Caracas",
      });
    case "farmatodo-ve":
      if (!env.SOURCE_FARMATODO_ENABLED) return null;
      return new FarmatodoAlgoliaConnector({
        retailerSlug: "farmatodo-ve",
        appId: env.FARMATODO_ALGOLIA_APP_ID,
        apiKey: env.FARMATODO_ALGOLIA_API_KEY,
        indexName: env.FARMATODO_ALGOLIA_INDEX,
        region: "La Guaira / Caracas",
      });
    case "central-madeirense":
      if (!env.SOURCE_CENTRAL_MADEIRENSE_ENABLED) return null;
      return new WooCommerceStoreConnector({
        retailerSlug: "central-madeirense",
        baseUrl: env.CENTRAL_MADEIRENSE_BASE_URL,
        region: "La Guaira",
        currency: "USD",
      });
    case "puntoalmayor-la-guaira":
      if (!env.SOURCE_PUNTO_AL_MAYOR_ENABLED) return null;
      return new ShopifyCatalogConnector({
        retailerSlug: "puntoalmayor-la-guaira",
        baseUrl: "https://puntoalmayor.com",
        region: "La Guaira",
        currency: "USD",
      });
    case "viva-la-guaira":
      if (!env.SOURCE_VIVA_ENABLED) return null;
      return new CsCartStoreConnector({
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
      });
    case "locatel-caracas":
      if (!env.SOURCE_LOCATEL_ENABLED) return null;
      return new VtexCatalogConnector({
        retailerSlug: "locatel-caracas",
        baseUrl: "https://www.locatel.com.ve",
        region: "Caracas",
        currency: "VES",
      });
    case "excelsior-gama":
      if (!env.SOURCE_GAMA_ENABLED) return null;
      return new GamaOccConnector({
        retailerSlug: "excelsior-gama",
        warehouseCode: env.GAMA_WAREHOUSE_CODE,
        region: "Caracas",
      });
    default:
      return null;
  }
}
