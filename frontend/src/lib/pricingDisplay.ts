import {
  BUGGY_PRICE_1_PASSENGER,
  BUGGY_PRICE_2_PASSENGERS,
  calculateTotalWithTax,
  TAX_PERCENT
} from "../api/client";

export function soloPassengerTotal() {
  return calculateTotalWithTax(BUGGY_PRICE_1_PASSENGER);
}

export function pairSharingTotal() {
  return calculateTotalWithTax(BUGGY_PRICE_2_PASSENGERS);
}

export function publicFromPrice() {
  return soloPassengerTotal();
}

export function pricingNoteValues() {
  const pairTotal = pairSharingTotal();
  return {
    solo: soloPassengerTotal(),
    pairEach: pairTotal / 2,
    pairTotal,
    taxPercent: TAX_PERCENT
  };
}
