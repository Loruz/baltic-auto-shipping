// M4: server-rendered lot page (SEO). M5 adds the landed price, M6 the bid form.
export default async function LotPage({ params }: PageProps<"/[locale]/lot/[source]/[id]">) {
  const { source, id } = await params;
  return (
    <h1 className="font-heading text-2xl font-bold">
      Lot {source.toUpperCase()} {id}
    </h1>
  );
}
