import PageShell from "@/components/common/PageShell";

export default function ProductPage({ params }: { params: { id: string } }) {
  return <PageShell title={`Product ${params.id}`} description="Review the product details and pricing." />;
}
