import { notFound } from "next/navigation";
import { getProductDetailSnapshot } from "@/features/basket/application/get-dashboard-snapshot";
import { ProductComparisonView } from "@/features/basket/ui/product-comparison-view";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let detail = null;
  try {
    detail = await getProductDetailSnapshot(slug);
  } catch {
    detail = null;
  }

  if (!detail) {
    notFound();
  }

  return (
    <ProductComparisonView
      product={detail.product}
      history={detail.history}
    />
  );
}
