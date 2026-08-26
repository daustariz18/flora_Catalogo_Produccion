import { useEffect, useRef, useState } from "react";
import type { ProductSortMode } from "./ProductGrid";

interface ProductSortDropdownProps {
  value: ProductSortMode;
  onChange: (mode: ProductSortMode) => void;
}

const SORT_OPTIONS: Array<{ value: ProductSortMode; label: string }> = [
  { value: "code-asc", label: "Codigo" },
  { value: "name-asc", label: "A-Z" },
  { value: "name-desc", label: "Z-A" },
  { value: "price-desc", label: "Precio mas alto" },
  { value: "price-asc", label: "Precio mas bajo" },
];

export function ProductSortDropdown({ value, onChange }: ProductSortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="product-sort" ref={dropdownRef}>
      <button
        type="button"
        className={`product-sort-trigger ${isOpen ? "product-sort-trigger-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="product-sort-label">Ordenar</span>
        <span className="product-sort-value">{selectedOption.label}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M5.8 7.5 10 11.7l4.2-4.2 1.1 1.1L10 13.9 4.7 8.6z" />
        </svg>
      </button>

      <div className={`product-sort-menu ${isOpen ? "product-sort-menu-open" : ""}`} role="listbox">
        {SORT_OPTIONS.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              className={`product-sort-option ${isSelected ? "product-sort-option-active" : ""}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {isSelected ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="m7.8 13.2-3-3 1.1-1.1 1.9 1.9 6.3-6.3 1.1 1.1z" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
