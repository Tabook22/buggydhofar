const CALLBACK_FIELD_ALIASES: Record<string, readonly string[]> = {
  amount: ["amount", "Amount"],
  currencyId: ["currencyId", "CurrencyId"],
  customerId: ["customerId", "CustomerId"],
  customerTokenId: ["customerTokenId", "CustomerTokenId"],
  merchantId: ["merchantId", "MerchantId"],
  merchantReference: ["merchantReference", "MerchantReference"],
  responseCode: ["responseCode", "ResponseCode"],
  terminalId: ["terminalId", "TerminalId"],
  transactionId: ["transactionId", "TransactionId"],
  transactionTime: ["transactionTime", "TransactionTime"],
  secureHashValue: ["secureHashValue", "SecureHash", "secureHash"]
};

function firstPresent(source: URLSearchParams | Record<string, unknown>, aliases: readonly string[]): string {
  if (source instanceof URLSearchParams) {
    for (const key of aliases) {
      const value = source.get(key);
      if (value) return value;
    }
    return "";
  }
  for (const key of aliases) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).length > 0) {
      return String(value);
    }
  }
  return "";
}

export function normalizeAmwalCallback(
  source: URLSearchParams | Record<string, unknown>
): Record<string, string> | null {
  const data: Record<string, string> = {};
  let found = false;
  for (const [canonical, aliases] of Object.entries(CALLBACK_FIELD_ALIASES)) {
    const value = firstPresent(source, aliases);
    if (value) {
      data[canonical] = value;
      found = true;
    }
  }
  return found ? data : null;
}

export function hasAmwalCallbackParams(searchParams: URLSearchParams): boolean {
  return Object.values(CALLBACK_FIELD_ALIASES).some((aliases) => aliases.some((key) => searchParams.has(key)));
}

const SUCCESS_RESPONSE_CODES = new Set(["00", "0", "000", "0000", "00000"]);

export function hasAmwalTransactionId(data: Record<string, string>): boolean {
  return Boolean((data.transactionId || "").trim());
}

export function hasSuccessfulAmwalCallback(data: Record<string, string>): boolean {
  const txn = (data.transactionId || "").trim();
  if (!txn) return false;
  const code = (data.responseCode || "").trim();
  if (!code) return true;
  return SUCCESS_RESPONSE_CODES.has(code);
}

export function shouldRetryPaymentCompletion(data: Record<string, string> | null): boolean {
  return Boolean(data && hasAmwalTransactionId(data));
}

export function shouldDismissAfterFailedPayment(data: Record<string, string> | null): boolean {
  if (!data) return true;
  return !hasAmwalTransactionId(data);
}