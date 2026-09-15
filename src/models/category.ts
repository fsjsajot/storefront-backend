import type { Image } from './image.js';

export interface Category {
  slug: string;
  name: string;
  description: string;
  image: Image;
}
