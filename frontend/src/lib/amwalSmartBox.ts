export type AmwalSmartBoxConfig = {
  booking_id: number;
  booking_number: string;
  script_url: string;
  mid: string;
  tid: string;
  currency_id: number;
  amount_trxn: string;
  merchant_reference: string;
  language_id: string;
  payment_view_type: number;
  trx_date_time: string;
  session_token: string;
  contact_info_type: number;
  return_url: string;
  cancel_url: string;
  ignore_receipt: string;
  secure_hash: string;
  primary_color: string;
};

export type AmwalCallbackData = Record<string, unknown>;

type AmwalCheckout = {
  configure: Record<string, unknown> & {
    SmartBoxColorConfig?: { PrimaryColor: string };
  };
  showSmartBox: () => void;
};

declare global {
  interface Window {
    SmartBox?: {
      Checkout: AmwalCheckout;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

export function loadAmwalScript(url: string): Promise<void> {
  if (window.SmartBox?.Checkout) {
    return Promise.resolve();
  }
  if (scriptLoading) {
    return scriptLoading;
  }
  scriptLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-amwal-smartbox]");
    if (existing) {
      if (window.SmartBox?.Checkout) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load AMWAL SmartBox")));
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.amwalSmartbox = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load AMWAL SmartBox"));
    document.head.appendChild(script);
  });
  return scriptLoading;
}

type AmwalCallbacks = {
  onComplete: (data: AmwalCallbackData) => void;
  onError: (data: AmwalCallbackData) => void;
  onCancel: () => void;
};

export async function openAmwalSmartBox(config: AmwalSmartBoxConfig, callbacks: AmwalCallbacks) {
  await loadAmwalScript(config.script_url);
  const checkout = window.SmartBox?.Checkout;
  if (!checkout) {
    throw new Error("AMWAL SmartBox is not available");
  }
  checkout.configure = {
    MID: config.mid,
    TID: config.tid,
    CurrencyId: config.currency_id,
    AmountTrxn: config.amount_trxn,
    MerchantReference: config.merchant_reference,
    LanguageId: config.language_id,
    PaymentViewType: config.payment_view_type,
    TrxDateTime: config.trx_date_time,
    SessionToken: config.session_token,
    ContactInfoType: config.contact_info_type,
    ReturnUrl: config.return_url,
    CancelUrl: config.cancel_url,
    IgnoreReceipt: config.ignore_receipt,
    SecureHash: config.secure_hash,
    completeCallback: callbacks.onComplete,
    errorCallback: callbacks.onError,
    cancelCallback: callbacks.onCancel
  };
  checkout.configure.SmartBoxColorConfig = { PrimaryColor: config.primary_color };
  checkout.showSmartBox();
}
