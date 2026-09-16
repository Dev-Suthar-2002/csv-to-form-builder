// seed.ts
// Reads a CSV form-schema file and upserts one MongoDB document per product_id.
// Run with: npm run seed

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

// __dirname doesn't exist in ES modules — this is the equivalent.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "brokerlift_clone";
const CSV_PATH = path.join(__dirname, "data", "auto_insurance_schema.csv");

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in .env");
}

interface RawRow {
  product_id: string;
  section: string;
  field_name: string;
  label: string;
  input_type: string;
  options: string;
  required: string;
  order: string;
  placeholder: string;
  default_value: string;
}

interface FormField {
  field_name: string;
  label: string;
  input_type: string;
  options: string[];
  required: boolean;
  order: number;
  placeholder?: string;
  default_value?: string;
}

interface FormSection {
  section: string;
  fields: FormField[];
}

function toFormField(row: RawRow): FormField {
  return {
    field_name: row.field_name.trim(),
    label: row.label.trim(),
    input_type: row.input_type.trim(),
    options: row.options ? row.options.split("|").map((o) => o.trim()) : [],
    required: row.required.trim().toLowerCase() === "true",
    order: Number(row.order) || 0,
    placeholder: row.placeholder?.trim() || undefined,
    default_value: row.default_value?.trim() || undefined,
  };
}

// Catches bad data before it ever reaches the database.
function validateField(field: FormField, rowNumber: number) {
  const needsOptions = ["select", "radio", "checkbox_group"].includes(field.input_type);
  if (needsOptions && field.options.length === 0) {
    throw new Error(
      `Row ${rowNumber}: field "${field.field_name}" is type "${field.input_type}" but has no options`
    );
  }
  if (!field.field_name || !field.label || !field.input_type) {
    throw new Error(`Row ${rowNumber}: missing field_name, label, or input_type`);
  }
}

function groupByProductAndSection(rows: RawRow[]) {
  const products = new Map<string, Map<string, FormField[]>>();

  rows.forEach((row, index) => {
    const field = toFormField(row);
    validateField(field, index + 2); // +2 = header row + 0-based index

    const productId = row.product_id.trim();
    const sectionName = row.section.trim();

    if (!products.has(productId)) products.set(productId, new Map());
    const sections = products.get(productId)!;

    if (!sections.has(sectionName)) sections.set(sectionName, []);
    sections.get(sectionName)!.push(field);
  });

  return products;
}

async function seed() {
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows: RawRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  const products = groupByProductAndSection(rows);

  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI as string);
  await client.connect();

  const collection = client.db(DB_NAME).collection("form_schemas");

  for (const [productId, sectionsMap] of products) {
    const sections: FormSection[] = Array.from(sectionsMap.entries()).map(
      ([section, fields]) => ({
        section,
        fields: fields.sort((a, b) => a.order - b.order),
      })
    );

    await collection.updateOne(
      { product_id: productId },
      { $set: { product_id: productId, sections, updated_at: new Date() } },
      { upsert: true }
    );

    console.log(`Seeded "${productId}" — ${sections.length} section(s)`);
  }

  await client.close();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
