// app/products/[id]/page.tsx
import DynamicForm from "@/components/DynamicForm";

async function getSchema(id: string) {
  // Local-dev only: hardcoded origin. If you ever deploy this, replace
  // with an environment variable (e.g. process.env.NEXT_PUBLIC_BASE_URL).
  const res = await fetch(`http://localhost:3000/api/forms/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export default async function ProductFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schema = await getSchema(id);

  if (!schema) {
    return (
      <main style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1.5rem" }}>
        <p>No form found for &quot;{id}&quot;.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem", textTransform: "capitalize" }}>
        {id.replace(/_/g, " ")} quote
      </h1>
      <DynamicForm schema={schema} />
    </main>
  );
}
