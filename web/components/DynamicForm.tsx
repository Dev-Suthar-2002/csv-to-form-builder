// components/DynamicForm.tsx
"use client";

import { useState, type ComponentType, type FormEvent } from "react";
import styles from "./DynamicForm.module.css";

interface FormField {
  field_name: string;
  label: string;
  input_type: string;
  options: string[];
  required: boolean;
  order: number;
  placeholder?: string | null;
  default_value?: string | null;
}

interface FormSection {
  section: string;
  fields: FormField[];
}

interface FormSchema {
  product_id: string;
  sections: FormSection[];
}

type FieldValue = string | boolean;
type FormValues = Record<string, FieldValue>;

interface FieldProps {
  field: FormField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

// input_type values that map directly onto a native <input type="...">.
const NATIVE_INPUT_TYPES = new Set(["text", "email", "tel", "number", "date"]);

function TextField({ field, value, onChange }: FieldProps) {
  return (
    <input
      className={styles.input}
      type={field.input_type}
      id={field.field_name}
      value={value as string}
      placeholder={field.placeholder ?? undefined}
      required={field.required}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextareaField({ field, value, onChange }: FieldProps) {
  return (
    <textarea
      className={styles.textarea}
      id={field.field_name}
      value={value as string}
      placeholder={field.placeholder ?? undefined}
      required={field.required}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectField({ field, value, onChange }: FieldProps) {
  return (
    <select
      className={styles.select}
      id={field.field_name}
      value={value as string}
      required={field.required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        Select...
      </option>
      {field.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function RadioField({ field, value, onChange }: FieldProps) {
  return (
    <div className={styles.radioGroup} role="radiogroup">
      {field.options.map((option) => (
        <label key={option} className={styles.radioLabel}>
          <input
            type="radio"
            name={field.field_name}
            value={option}
            checked={value === option}
            required={field.required}
            onChange={(e) => onChange(e.target.value)}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

function CheckboxField({ field, value, onChange }: FieldProps) {
  return (
    <input
      className={styles.checkbox}
      type="checkbox"
      id={field.field_name}
      checked={value as boolean}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

// The core of the schema-driven pattern: input_type -> component.
// Adding a new field type later means one new entry here — nothing
// else in this file, the API, or the page needs to change.
const fieldRegistry: Record<string, ComponentType<FieldProps>> = {
  textarea: TextareaField,
  select: SelectField,
  radio: RadioField,
  checkbox: CheckboxField,
};
for (const type of NATIVE_INPUT_TYPES) {
  fieldRegistry[type] = TextField;
}

function defaultValueFor(field: FormField): FieldValue {
  if (field.input_type === "checkbox") {
    return field.default_value === "true";
  }
  return field.default_value ?? "";
}

export default function DynamicForm({ schema }: { schema: FormSchema }) {
  const [values, setValues] = useState<FormValues>(() => {
    const initial: FormValues = {};
    schema.sections.forEach((section) => {
      section.fields.forEach((field) => {
        initial[field.field_name] = defaultValueFor(field);
      });
    });
    return initial;
  });

  function handleChange(fieldName: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    console.log("Form submitted:", values);
    alert("Submitted — check the browser console for the values.");
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {schema.sections.map((section) => (
        <fieldset key={section.section} className={styles.fieldset}>
          <legend className={styles.legend}>{section.section}</legend>
          {section.fields.map((field) => {
            const FieldComponent = fieldRegistry[field.input_type];

            if (!FieldComponent) {
              console.warn(`No component registered for input_type "${field.input_type}"`);
              return null;
            }

            return (
              <div key={field.field_name} className={styles.fieldRow}>
                <label htmlFor={field.field_name} className={styles.label}>
                  {field.label}
                  {field.required && <span aria-hidden="true"> *</span>}
                </label>
                <FieldComponent
                  field={field}
                  value={values[field.field_name]}
                  onChange={(value) => handleChange(field.field_name, value)}
                />
              </div>
            );
          })}
        </fieldset>
      ))}
      <button type="submit" className={styles.submit}>
        Get quote
      </button>
    </form>
  );
}
