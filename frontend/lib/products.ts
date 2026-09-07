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
    description: "A pair of entry passes to the biggest student club night on campus this Friday. Includes fast-track entry and one welcome drink each. Great for a night out with a friend or as a surprise gift.",
    images: [IMG.club, IMG.clubAlt],
  },
  {
    id: 2,
    slug: "rooftop-movie-night-passes",
    title: "Weekend rooftop movie night passes",
    category: "Events",
    price: 9500,
    rating: 4.6,
    seller: "Campus Nightlife Co.",
    description: "Two passes to the weekend rooftop cinema series overlooking the main quad. Bring a blanket and enjoy a curated double feature under the stars with fellow students.",
    images: [IMG.clubAlt, IMG.club],
  },
  {
    id: 3,
    slug: "design-photography-hardback",
    title: "Design and photography hardback book",
    category: "Books",
    price: 12000,
    rating: 4.9,
    seller: "Amina's Book Corner",
    description: "A beautifully illustrated hardback covering modern design and photography principles. Gently used with no markings, perfect for design, art, or media students.",
    images: [IMG.book, IMG.bookAlt],
  },
  {
    id: 4,
    slug: "chemistry-past-questions-pack",
    title: "Organic chemistry past questions pack",
    category: "Books",
    price: 4500,
    rating: 4.7,
    seller: "Amina's Book Corner",
    description: "Five years of compiled past questions and worked solutions for organic chemistry courses. Spiral-bound and printed on quality paper, ideal for exam revision.",
    images: [IMG.bookAlt, IMG.book],
  },
  {
    id: 5,
    slug: "dinner-for-two-garden-room",
    title: "Dinner for two at The Garden Room",
    category: "Food & Drink",
    price: 35000,
    rating: 4.9,
    seller: "The Garden Room",
    description: "A reserved table for two at The Garden Room, including a three-course set menu. A perfect way to treat yourself or someone special near campus.",
    images: [IMG.dinner, IMG.dinnerAlt],
  },
  {
    id: 6,
    slug: "campus-cafe-breakfast-voucher",
    title: "Campus café breakfast voucher",
    category: "Food & Drink",
    price: 6000,
    rating: 4.5,
    seller: "The Garden Room",
    description: "A breakfast voucher redeemable at the campus café, covering a hot meal and a drink of your choice. Valid any weekday morning before 11am.",
    images: [IMG.dinnerAlt, IMG.dinner],
  },
  {
    id: 7,
    slug: "wireless-headphones-excellent-condition",
    title: "Wireless headphones in excellent condition",
    category: "Technology",
    price: 28000,
    rating: 4.8,
    seller: "Tunde's Tech Store",
    description: "Lightly used over-ear wireless headphones with strong battery life and noise isolation, great for lectures and study sessions. Comes with charging cable and case.",
    images: [IMG.headphones, IMG.headphonesAlt],
  },
  {
    id: 8,
    slug: "laptop-stand-fast-charger-bundle",
    title: "Laptop stand + fast charger bundle",
    category: "Technology",
    price: 18500,
    rating: 4.7,
    seller: "Tunde's Tech Store",
    description: "A portable, foldable laptop stand paired with a compact fast charger. Ideal for study sessions in the library or hostel, keeps your setup ergonomic and charged.",
    images: [IMG.headphonesAlt, IMG.headphones],
  },
];

export const categories = ["All", "Events", "Books", "Food & Drink", "Technology"];

export function getProductById(id: number) {
  return products.find((product) => product.id === id);
}

export function formatNaira(value: number) {
  return `₦${value.toLocaleString()}`;
}
