"use client";

import { useEffect, useState } from "react";
import Select, {
  StylesConfig,
  MultiValue,
  SingleValue,
  GroupBase,
  Props as RSProps,
} from "react-select";

type Option = { label: string; value: string };
type SelectProps = RSProps<Option, boolean, GroupBase<Option>>;

type Props = {
  options: string[];
  value: string[];                   // controlled array (even for single)
  onChange: (v: string[]) => void;   // normalized array of values
  placeholder?: string;
  isMulti?: boolean;                 // default true
  instanceId?: string;               // stable id for a11y; pass "type"/"brand"/...
};

function isOptionArray(
  v: MultiValue<Option> | SingleValue<Option>
): v is MultiValue<Option> {
  return Array.isArray(v);
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  isMulti = true,
  instanceId,
}: Props) {
  // Gate rendering to client to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const opts: Option[] = options.map((o) => ({ label: o, value: o }));
  const selected: Option[] = value.map((v) => ({ label: v, value: v }));

  const styles: StylesConfig<Option, boolean> = {
    control: (base, state) => ({
      ...base,
      border: "1px solid var(--border)",
      borderRadius: 12,
      background: "rgba(255,255,255,0.7)",
      minHeight: 40,
      boxShadow: state.isFocused ? "0 0 0 2px var(--primary)" : "0 1px 0 rgba(0,0,0,0.02)",
      ":hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
    }),
    placeholder: (b) => ({ ...b, color: "rgba(0,0,0,0.45)" }),
    valueContainer: (b) => ({ ...b, padding: "2px 10px" }),
    input: (b) => ({ ...b, margin: 0 }),
    multiValue: (b) => ({
      ...b,
      background: "#eef5cf", // soft olive tint
      borderRadius: 999,
    }),
    multiValueLabel: (b) => ({ ...b, color: "#4b5a0b", paddingRight: 6 }),
    multiValueRemove: (b) => ({
      ...b,
      color: "#4b5a0b",
      ":hover": { background: "transparent", color: "#2f3a06" },
    }),
    option: (b, s) => ({
      ...b,
      background: s.isSelected ? "#a6bf2a" : s.isFocused ? "rgba(166,191,42,0.12)" : "transparent",
      color: s.isSelected ? "var(--primary-ink)" : "inherit",
      ":active": { background: "#a6bf2a" },
    }),
    menu: (b) => ({
      ...b,
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
    }),
    indicatorsContainer: (b) => ({ ...b, paddingRight: 6 }),
    clearIndicator: (b) => ({ ...b, padding: 6 }),
    dropdownIndicator: (b) => ({ ...b, padding: 6 }),
  };

  const handleChange = (sel: MultiValue<Option> | SingleValue<Option>) => {
    if (!sel) return onChange([]);
    if (isOptionArray(sel)) return onChange(sel.map((o) => o.value));
    return onChange([sel.value]);
  };

  // Render a skeleton during SSR/first paint to keep layout stable
  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5"
        style={{ minHeight: 40 }}
      />
    );
  }

  const selectProps: SelectProps = {
    isMulti,
    options: opts,
    value: selected,
    onChange: handleChange,
    placeholder,
    styles,
    classNamePrefix: "ms",
    instanceId,
  };

  return <Select {...selectProps} />;
}
