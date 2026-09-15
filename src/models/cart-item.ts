export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}
