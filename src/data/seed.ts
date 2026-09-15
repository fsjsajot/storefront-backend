import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { Image, Price } from '../models/index.js';

interface SeedVariant {
  name: string;
  sku: string;
  price?: Price;
  stock: number;
}

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  price: Price;
  images: Image[];
  categorySlug: string;
  stock: number;
  rating: number;
  variants: SeedVariant[];
}

interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  image: Image;
}

const img = (src: string, alt: string): Image => ({
  src,
  alt,
  width: 1200,
  height: 900,
});

const usd = (amount: number): Price => ({ amount, currency: 'USD' });

const categories: SeedCategory[] = [
  {
    slug: 'audio',
    name: 'Audio',
    description: 'Headphones, earbuds, and speakers for every listener.',
    image: img('https://images.example.com/categories/audio.webp', 'Audio'),
  },
  {
    slug: 'wearables',
    name: 'Wearables',
    description: 'Smartwatches and trackers that keep pace with your day.',
    image: img('https://images.example.com/categories/wearables.webp', 'Wearables'),
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    description: 'Chargers, cases, and everyday gear for your devices.',
    image: img('https://images.example.com/categories/accessories.webp', 'Accessories'),
  },
];

const products: SeedProduct[] = [
  {
    slug: 'aurora-headphones',
    name: 'Aurora Wireless Headphones',
    description:
      'Over-ear wireless headphones with adaptive noise cancellation and 40-hour battery life.',
    price: usd(199.99),
    images: [
      img(
        'https://images.example.com/products/aurora-headphones.webp',
        'Aurora Wireless Headphones',
      ),
    ],
    categorySlug: 'audio',
    stock: 43,
    rating: 4.7,
    variants: [
      { name: 'Onyx Black', sku: 'AUR-HP-BLK', stock: 25 },
      { name: 'Arctic White', sku: 'AUR-HP-WHT', price: usd(209.99), stock: 18 },
    ],
  },
  {
    slug: 'echo-earbuds',
    name: 'Echo True Wireless Earbuds',
    description: 'Compact true wireless earbuds with a charging case and six-hour playtime.',
    price: usd(129.99),
    images: [
      img('https://images.example.com/products/echo-earbuds.webp', 'Echo True Wireless Earbuds'),
    ],
    categorySlug: 'audio',
    stock: 120,
    rating: 4.3,
    variants: [],
  },
  {
    slug: 'bass-blast-speaker',
    name: 'Bass Blast Portable Speaker',
    description: 'Rugged, waterproof portable speaker with deep bass and 24-hour playtime.',
    price: usd(89.99),
    images: [
      img('https://images.example.com/products/bass-blast-speaker.webp', 'Bass Blast Speaker'),
    ],
    categorySlug: 'audio',
    stock: 64,
    rating: 4.5,
    variants: [
      { name: 'Charcoal', sku: 'BBS-SPK-CHA', stock: 30 },
      { name: 'Teal', sku: 'BBS-SPK-TEA', stock: 12 },
    ],
  },
  {
    slug: 'studio-pro-headphones',
    name: 'Studio Pro Monitoring Headphones',
    description: 'Wired reference headphones tuned for detail, clarity, and a flat response.',
    price: usd(249.0),
    images: [
      img(
        'https://images.example.com/products/studio-pro-headphones.webp',
        'Studio Pro Headphones',
      ),
    ],
    categorySlug: 'audio',
    stock: 32,
    rating: 4.8,
    variants: [],
  },
  {
    slug: 'sonic-sport-earbuds',
    name: 'Sonic Sport Earbuds',
    description: 'Sweat-resistant earbuds with ear hooks and a secure fit for workouts.',
    price: usd(79.99),
    images: [
      img('https://images.example.com/products/sonic-sport-earbuds.webp', 'Sonic Sport Earbuds'),
    ],
    categorySlug: 'audio',
    stock: 88,
    rating: 4.1,
    variants: [
      { name: 'Black / Lime', sku: 'SSN-EB-BKL', stock: 22 },
      { name: 'Black / Teal', sku: 'SSN-EB-BKT', stock: 10 },
    ],
  },
  {
    slug: 'aria-compact-soundbar',
    name: 'Aria Compact Soundbar',
    description: 'Slim soundbar that brings room-filling sound to your living room.',
    price: usd(159.99),
    images: [
      img('https://images.example.com/products/aria-soundbar.webp', 'Aria Compact Soundbar'),
    ],
    categorySlug: 'audio',
    stock: 27,
    rating: 4.4,
    variants: [],
  },
  {
    slug: 'pulse-fitness-watch',
    name: 'Pulse Fitness Smartwatch',
    description: 'Smartwatch with heart rate tracking, GPS, and a week of battery life.',
    price: usd(149.99),
    images: [
      img(
        'https://images.example.com/products/pulse-fitness-watch.webp',
        'Pulse Fitness Smartwatch',
      ),
    ],
    categorySlug: 'wearables',
    stock: 51,
    rating: 4.6,
    variants: [
      { name: '40mm', sku: 'PLS-WT-40', stock: 40 },
      { name: '44mm', sku: 'PLS-WT-44', price: usd(169.99), stock: 35 },
    ],
  },
  {
    slug: 'stride-activity-tracker',
    name: 'Stride Activity Tracker',
    description: 'Lightweight band that tracks steps, sleep, and daily activity.',
    price: usd(59.99),
    images: [
      img('https://images.example.com/products/stride-tracker.webp', 'Stride Activity Tracker'),
    ],
    categorySlug: 'wearables',
    stock: 140,
    rating: 4.2,
    variants: [],
  },
  {
    slug: 'tempo-heart-rate-watch',
    name: 'Tempo Heart Rate Watch',
    description: 'Continuous heart rate monitoring in a minimalist analog-style case.',
    price: usd(189.99),
    images: [
      img(
        'https://images.example.com/products/tempo-heart-rate-watch.webp',
        'Tempo Heart Rate Watch',
      ),
    ],
    categorySlug: 'wearables',
    stock: 38,
    rating: 4.5,
    variants: [],
  },
  {
    slug: 'drift-sleep-band',
    name: 'Drift Sleep Tracking Band',
    description: 'Sleep-focused band with smart alarms and sleep stage insights.',
    price: usd(99.99),
    images: [img('https://images.example.com/products/drift-sleep-band.webp', 'Drift Sleep Band')],
    categorySlug: 'wearables',
    stock: 46,
    rating: 3.9,
    variants: [
      { name: 'Midnight', sku: 'DRF-SLP-MID', stock: 15 },
      { name: 'Blush', sku: 'DRF-SLP-BLU', stock: 8 },
    ],
  },
  {
    slug: 'cadence-fitness-ring',
    name: 'Cadence Fitness Ring',
    description: 'Titanium smart ring that tracks activity and recovery around the clock.',
    price: usd(229.99),
    images: [
      img('https://images.example.com/products/cadence-fitness-ring.webp', 'Cadence Fitness Ring'),
    ],
    categorySlug: 'wearables',
    stock: 19,
    rating: 4.0,
    variants: [],
  },
  {
    slug: 'volt-65w-charger',
    name: 'Volt 65W USB-C Charger',
    description: 'Compact dual-port GaN charger that powers laptops, tablets, and phones.',
    price: usd(39.99),
    images: [
      img('https://images.example.com/products/volt-65w-charger.webp', 'Volt 65W USB-C Charger'),
    ],
    categorySlug: 'accessories',
    stock: 95,
    rating: 4.6,
    variants: [],
  },
  {
    slug: 'shell-phone-case',
    name: 'Shell Protective Phone Case',
    description: 'Drop-tested case with a slim profile and tactile buttons.',
    price: usd(24.99),
    images: [img('https://images.example.com/products/shell-phone-case.webp', 'Shell Phone Case')],
    categorySlug: 'accessories',
    stock: 130,
    rating: 4.3,
    variants: [
      { name: 'Clear', sku: 'SHL-CSE-CLR', stock: 50 },
      { name: 'Smoke', sku: 'SHL-CSE-SMK', stock: 40 },
      { name: 'Rose', sku: 'SHL-CSE-RSE', stock: 25 },
    ],
  },
  {
    slug: 'pivot-laptop-stand',
    name: 'Pivot Aluminum Laptop Stand',
    description: 'Foldable aluminum stand with seven height settings for better posture.',
    price: usd(54.99),
    images: [
      img('https://images.example.com/products/pivot-laptop-stand.webp', 'Pivot Laptop Stand'),
    ],
    categorySlug: 'accessories',
    stock: 58,
    rating: 4.7,
    variants: [],
  },
  {
    slug: 'weave-braided-cable',
    name: 'Weave Braided USB-C Cable',
    description: 'Durable braided cable rated for over 10,000 bends.',
    price: usd(14.99),
    images: [
      img('https://images.example.com/products/weave-braided-cable.webp', 'Weave Braided Cable'),
    ],
    categorySlug: 'accessories',
    stock: 210,
    rating: 4.4,
    variants: [
      { name: '1m', sku: 'WVE-CBL-1M', stock: 60 },
      { name: '2m', sku: 'WVE-CBL-2M', price: usd(17.99), stock: 45 },
    ],
  },
  {
    slug: 'pack-tech-organizer',
    name: 'Pack Tech Travel Organizer',
    description: 'Water-resistant organizer with dedicated sleeves for cables and chargers.',
    price: usd(34.99),
    images: [
      img('https://images.example.com/products/pack-tech-organizer.webp', 'Pack Tech Organizer'),
    ],
    categorySlug: 'accessories',
    stock: 74,
    rating: 4.5,
    variants: [],
  },
];

async function seed(): Promise<void> {
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  for (const category of categories) {
    await prisma.category.create({
      data: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        image: category.image as unknown as Prisma.InputJsonValue,
      },
    });

    for (const product of products.filter((p) => p.categorySlug === category.slug)) {
      await prisma.product.create({
        data: {
          slug: product.slug,
          name: product.name,
          description: product.description,
          priceAmount: product.price.amount,
          priceCurrency: product.price.currency,
          images: product.images as unknown as Prisma.InputJsonValue,
          categorySlug: product.categorySlug,
          stock: product.stock,
          rating: product.rating,
          variants: {
            create: product.variants.map((variant) => ({
              name: variant.name,
              sku: variant.sku,
              priceAmount: variant.price?.amount ?? null,
              priceCurrency: variant.price?.currency ?? null,
              stock: variant.stock,
            })),
          },
        },
      });
    }
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products`);
}

void seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
