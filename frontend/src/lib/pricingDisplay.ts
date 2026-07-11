import {
  BUGGY_PRICE_1_PASSENGER,
  BUGGY_PRICE_PER_PASSENGER_2,
  calculateTotalWithTax,
  TAX_PERCENT
} from "../api/client";

export function soloPassengerTotal() {
  return calculateTotalWithTax(BUGGY_PRICE_1_PASSENGER);
}

export function pairSharingTotal() {
  return calculateTotalWithTax(BUGGY_PRICE_PER_PASSENGER_2 * 2);
}

export function publicFromPrice() {
  return soloPassengerTotal();
}

export function pricingNoteValues() {
  return {
    solo: BUGGY_PRICE_1_PASSENGER,
    pairEach: BUGGY_PRICE_PER_PASSENGER_2,
    pairTotal: BUGGY_PRICE_PER_PASSENGER_2 * 2,
    taxPercent: TAX_PERCENT
  };
}