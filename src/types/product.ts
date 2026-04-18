export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  qty: number;
  status: "active" | "draft" | "archived";
  featured: boolean;
  thumbnail: string | null;
  image1: string | null;
  material: string | null;
  shape: string | null;
  rating: number | null;
  reviews_count: number | null;

  // used by ShopClient; allow null for older products
  product_type: "frames" | "eyedrops" | "accessory" | "solution" | "contact-lens" | null;
  category: string | null;
  size_ml: number | null;
  size_count: number | null;
  dosage: string | null;
};
