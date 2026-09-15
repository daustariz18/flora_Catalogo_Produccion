import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CategoriaResumen } from "../../../shared/types/catalog";
import { resolveProductImageCandidates } from "../utils/cloudfront";

interface CategoryGridProps {
  categories: CategoriaResumen[];
  companyColor: string;
  emptyMessage: string;
  onSelectCategory: (categoryId: number) => void;
}

interface CategoryCardProps {
  summary: CategoriaResumen;
  companyColor: string;
  onSelectCategory: () => void;
}

export function CategoryGrid({ categories, companyColor, emptyMessage, onSelectCategory }: CategoryGridProps) {
  if (!categories.length) {
    return (
      <div className="catalog-empty-state">
        <p className="empty-state">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className="category-card-grid" aria-label="Colecciones">
      {categories.map((summary) => (
        <CategoryCard
          key={summary.category.id}
          summary={summary}
          companyColor={companyColor}
          onSelectCategory={() => onSelectCategory(summary.category.id)}
        />
      ))}
    </section>
  );
}

const CategoryCard = memo(function CategoryCard({ summary, companyColor, onSelectCategory }: CategoryCardProps) {
  const [isImageLoading, setIsImageLoading] = useState(Boolean(summary.coverProduct));
  const [imageIndex, setImageIndex] = useState(0);

  const imageCandidates = useMemo(() => {
    if (!summary.coverProduct) {
      return [];
    }

    return resolveProductImageCandidates(summary.coverProduct, "", "md").filter(
      (candidate) => candidate !== "/product-placeholder.svg",
    );
  }, [summary.coverProduct]);

  useEffect(() => {
    setImageIndex(0);
    setIsImageLoading(Boolean(summary.coverProduct && imageCandidates.length));
  }, [summary.category.id, summary.coverProduct, imageCandidates.length]);

  const imageSrc = imageCandidates[imageIndex];
  const fallbackInitial = summary.category.nombre.trim().charAt(0).toUpperCase() || "C";

  return (
    <article className="category-card-shell">
      <button
        type="button"
        className="category-card"
        style={{ "--category-accent": companyColor } as CSSProperties}
        onClick={onSelectCategory}
        aria-label={`Ver arreglos de ${summary.category.nombre}`}
      >
        {imageSrc ? (
          <>
            {isImageLoading ? <span className="category-card-skeleton" aria-hidden="true" /> : null}
            <img
              className="category-card-image"
              src={imageSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setIsImageLoading(false)}
              onError={() => {
                const nextIndex = imageIndex + 1;
                setImageIndex(nextIndex);
                setIsImageLoading(nextIndex < imageCandidates.length);
              }}
            />
          </>
        ) : (
          <span className="category-card-fallback" aria-hidden="true">
            {fallbackInitial}
          </span>
        )}
        <span className="category-card-overlay" aria-hidden="true" />
        <span className="category-card-content">
          <span className="category-card-title">{summary.category.nombre}</span>
          <span className="category-card-action">Ver arreglos</span>
        </span>
      </button>
    </article>
  );
});

CategoryCard.displayName = "CategoryCard";
