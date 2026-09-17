// seed.ts
// Reads every CSV file in ./data and upserts one MongoDB document per product_id.
// Run with: npm run seed

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ quiet: true });

// __dirname doesn't exist in ES modules — this is the equivalent.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "brokerlift_clone";
const DATA_DIR = path.join(__dirname, "data");

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

// Catches bad data before it ever reaches the database. Takes the source
// file name so a bad row tells you exactly which CSV to go fix.
function validateField(field: FormField, source: string, rowNumber: number) {
  const needsOptions = ["select", "radio", "checkbox_group"].includes(field.input_type);
  if (needsOptions && field.options.length === 0) {
    throw new Error(
      `${source}, row ${rowNumber}: field "${field.field_name}" is type "${field.input_type}" but has no options`
    );
  }
  if (!field.field_name || !field.label || !field.input_type) {
    throw new Error(`${source}, row ${rowNumber}: missing field_name, label, or input_type`);
  }
}

// Reads every .csv file in the data folder, validates each row, and
// returns them all combined. This is what makes "drop a new CSV in and
// re-run" actually true — no hardcoded file name anywhere.
function readAllCsvRows(): RawRow[] {
  const csvFiles = fs.readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));

  if (csvFiles.length === 0) {
    throw new Error(`No CSV files found in ${DATA_DIR}`);
  }

  let allRows: RawRow[] = [];

  for (const fileName of csvFiles) {
    const filePath = path.join(DATA_DIR, fileName);
    const csvContent = fs.readFileSync(filePath, "utf-8");
    const rows: RawRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    rows.forEach((row, index) => {
      validateField(toFormField(row), fileName, index + 2); // +2 = header row + 0-based index
    });

    console.log(`Read ${rows.length} row(s) from ${fileName}`);
    allRows = allRows.concat(rows);
  }

  return allRows;
}

function groupByProductAndSection(rows: RawRow[]) {
  const products = new Map<string, Map<string, FormField[]>>();

  rows.forEach((row) => {
    const field = toFormField(row);
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
  const rows = readAllCsvRows();
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
