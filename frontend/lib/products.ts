export type Product = {
  id: number;
  slug: string;
  title: string;
  category: string;
  price: number;
  rating: number;
  seller: string;
  description: string;
  images: string[];

  sizes?: string[];
  colors?: string[];

  vendorId?: string;

  sellerCampus?: string | null;
  sellerUniversityId?: string | null;

  demandScore?: number;
};

const IMG = {
  club: "https://images.unsplash.com/photo-1664694428272-2f0ad5b10080?auto=format&fit=crop&q=80&w=1200",
  clubAlt: "https://images.unsplash.com/photo-1664694428272-2f0ad5b10080?auto=format&fit=crop&q=80&w=900&sat=-20",
  book: "https://images.unsplash.com/photo-1463185083322-3bf4d58a9775?auto=format&fit=crop&q=80&w=1200",
  bookAlt: "https://images.unsplash.com/photo-1463185083322-3bf4d58a9775?auto=format&fit=crop&q=80&w=900&sat=-20",
  dinner: "https://images.unsplash.com/photo-1724873290077-d06378ac8865?auto=format&fit=crop&q=80&w=1200",
  dinnerAlt: "https://images.unsplash.com/photo-1724873290077-d06378ac8865?auto=format&fit=crop&q=80&w=900&sat=-20",
  headphones: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1200",
  headphonesAlt: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=900&sat=-20",
};

export const products: Product[] = [
  {
    id: 1,
    slug: "friday-club-night-tickets",
    title: "Two tickets to the Friday student club night",
    category: "Events",
    price: 18000,
    rating: 4.8,
    seller: "Campus Nightlife Co.",
    description:
      "A pair of entry passes to the biggest student club night on campus this Friday.",
    images: [
      IMG.club,
      IMG.clubAlt,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 2,
    slug: "rooftop-movie-night-passes",
    title: "Weekend rooftop movie night passes",
    category: "Events",
    price: 9500,
    rating: 4.6,
    seller: "Campus Nightlife Co.",
    description:
      "Two passes to the weekend rooftop cinema series.",
    images: [
      IMG.clubAlt,
      IMG.club,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 3,
    slug: "design-photography-hardback",
    title: "Design and photography hardback book",
    category: "Books",
    price: 12000,
    rating: 4.9,
    seller: "Amina's Book Corner",
    description:
      "A beautifully illustrated hardback covering modern design and photography principles.",
    images: [
      IMG.book,
      IMG.bookAlt,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 4,
    slug: "chemistry-past-questions-pack",
    title: "Organic chemistry past questions pack",
    category: "Books",
    price: 4500,
    rating: 4.7,
    seller: "Amina's Book Corner",
    description:
      "Five years of compiled past questions and worked solutions.",
    images: [
      IMG.bookAlt,
      IMG.book,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 5,
    slug: "dinner-for-two-garden-room",
    title: "Dinner for two at The Garden Room",
    category: "Food & Drink",
    price: 35000,
    rating: 4.9,
    seller: "The Garden Room",
    description:
      "A reserved table for two at The Garden Room.",
    images: [
      IMG.dinner,
      IMG.dinnerAlt,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 6,
    slug: "campus-cafe-breakfast-voucher",
    title: "Campus café breakfast voucher",
    category: "Food & Drink",
    price: 6000,
    rating: 4.5,
    seller: "The Garden Room",
    description:
      "A breakfast voucher redeemable at the campus café.",
    images: [
      IMG.dinnerAlt,
      IMG.dinner,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 7,
    slug: "wireless-headphones-excellent-condition",
    title: "Wireless headphones in excellent condition",
    category: "Technology",
    price: 28000,
    rating: 4.8,
    seller: "Tunde's Tech Store",
    description:
      "Lightly used over-ear wireless headphones.",
    images: [
      IMG.headphones,
      IMG.headphonesAlt,
    ],
    sizes: [],
    colors: [],
  },

  {
    id: 8,
    slug: "laptop-stand-fast-charger-bundle",
    title: "Laptop stand + fast charger bundle",
    category: "Technology",
    price: 18500,
    rating: 4.7,
    seller: "Tunde's Tech Store",
    description:
      "A portable laptop stand paired with a compact fast charger.",
    images: [
      IMG.headphonesAlt,
      IMG.headphones,
    ],
    sizes: [],
    colors: [],
  },
];

export const categories = [
  "All",

  "Clothes & Accessories",
  "Cosmetics & Deodorants",
  "Hair & Beauty",
  "Shoes & Bags",

  "Food & Drink",
  "Technology",
  "Books",
  "Events",

  "Home & Hostel Essentials",
  "Printing & Stationery",
  "Fitness & Sports",

  "Tutoring & Academic Services",
  "Design & Digital Services",
  "Photography & Media",
  "Repairs & Technical Services",
  "Laundry & Cleaning",
  "Transportation & Errands",

  "Other",
];

export function getProductById(
  id:
    number
) {
  return products.find(
    (
      product
    ) =>
      product.id ===
      id
  );
}

export function formatNaira(
  value:
    number
) {
  return `₦${value.toLocaleString()}`;
}