export interface Empresa {
  id: number;
  nombre: string;
  logo: string;
  logoUrl?: string;
  colorPrimario: string;
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  id_producto?: number;
  codigo_producto?: string;
  codigoProduct?: string;
  nombre: string;
  precio: number;
  imagen: string;
  imagen_url?: string;
  imagen_sm?: string;
  imagen_md?: string;
  imagen_lg?: string;
  categoriaID: number;
  id_categoria?: number;
  categoriaNombre?: string;
  descripcion?: string;
}

export interface CatalogResponse {
  empresa: Empresa;
  categorias: Categoria[];
  productos: Producto[];
}
