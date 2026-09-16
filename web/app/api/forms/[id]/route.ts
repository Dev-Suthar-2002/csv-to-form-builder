// app/api/forms/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dbName = process.env.DB_NAME || "brokerlift_clone";

  try {
    const client = await clientPromise;
    const collection = client.db(dbName).collection("form_schemas");

    // Exclude Mongo's internal _id — the frontend doesn't need it.
    const schema = await collection.findOne(
      { product_id: id },
      { projection: { _id: 0 } }
    );

    if (!schema) {
      return NextResponse.json(
        { error: `No form schema found for product "${id}"` },
        { status: 404 }
      );
    }

    return NextResponse.json(schema);
  } catch (err) {
    console.error("Failed to fetch form schema:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
