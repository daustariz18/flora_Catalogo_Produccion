import type { CatalogViewMode } from "./ProductGrid";

interface ViewModeToggleProps {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
}

const VIEW_MODE_OPTIONS: Array<{
  value: CatalogViewMode;
  label: string;
  icon: "grid" | "list";
}> = [
  { value: "grid", label: "Vista en grilla", icon: "grid" },
  { value: "list", label: "Vista en lista", icon: "list" },
];

function ViewModeIcon({ icon }: { icon: "grid" | "list" }) {
  if (icon === "grid") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="4" width="6" height="6" rx="1.3" />
        <rect x="14" y="4" width="6" height="6" rx="1.3" />
        <rect x="4" y="14" width="6" height="6" rx="1.3" />
        <rect x="14" y="14" width="6" height="6" rx="1.3" />
      </svg>
    );
  }

  if (icon === "list") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="5" width="4" height="4" rx="1" />
        <rect x="10" y="6" width="10" height="2" rx="1" />
        <rect x="4" y="10" width="4" height="4" rx="1" />
        <rect x="10" y="11" width="10" height="2" rx="1" />
        <rect x="4" y="15" width="4" height="4" rx="1" />
        <rect x="10" y="16" width="10" height="2" rx="1" />
      </svg>
    );
  }

  return null;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="Cambiar vista del catalogo">
      {VIEW_MODE_OPTIONS.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={`view-mode-button ${isActive ? "view-mode-button-active" : ""}`}
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <ViewModeIcon icon={option.icon} />
          </button>
        );
      })}
    </div>
  );
}
