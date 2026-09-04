import { DEFAULT_PUBLIC_PRICING, PublicPricing } from "../api/client";

export function soloPassengerTotal(pricing: PublicPricing = DEFAULT_PUBLIC_PRICING) {
  return pricing.price_1_incl_vat;
}

export function pairSharingTotal(pricing: PublicPricing = DEFAULT_PUBLIC_PRICING) {
  return pricing.price_2_incl_vat;
}

export function publicFromPrice(pricing: PublicPricing = DEFAULT_PUBLIC_PRICING) {
  return soloPassengerTotal(pricing);
}

export function pricingNoteValues(pricing: PublicPricing = DEFAULT_PUBLIC_PRICING) {
  return {
    solo: pricing.price_1_incl_vat,
    pairEach: pricing.price_2_incl_vat / 2,
    pairTotal: pricing.price_2_incl_vat,
    taxPercent: pricing.vat_percent
  };
}
