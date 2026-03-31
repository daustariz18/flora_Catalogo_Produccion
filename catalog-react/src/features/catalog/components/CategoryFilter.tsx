import type { Categoria } from "../../../shared/types/catalog";

interface CategoryFilterProps {
  categories: Categoria[];
  selectedCategory: number | null;
  onChange: (categoryId: number | null) => void;
  companyColor: string;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onChange,
  companyColor,
}: CategoryFilterProps) {
  return (
    <section className="category-strip" aria-label="Filtrar arreglos por ocasion">
      <button
        type="button"
        className={`chip ${selectedCategory === null ? "chip-active" : ""}`}
        style={selectedCategory === null ? { borderColor: companyColor, backgroundColor: companyColor } : undefined}
        onClick={() => onChange(null)}
      >
        Todas
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={`chip ${selectedCategory === category.id ? "chip-active" : ""}`}
          style={
            selectedCategory === category.id
              ? { borderColor: companyColor, backgroundColor: companyColor }
              : undefined
          }
          onClick={() => onChange(category.id)}
        >
          {category.nombre}
        </button>
      ))}
    </section>
  );
}
