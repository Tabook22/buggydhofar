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
  apple_pay_enabled?: boolean;
  request_source?: string;
  apple_pay_element_id?: string;
  required_billing_contact_fields?: string[];
  required_shipping_contact_fields?: string[];
};

export type AmwalCallbackData = Record<string, unknown>;

type AmwalCheckout = {
  configure: Record<string, unknown> & {
    SmartBoxColorConfig?: { PrimaryColor: string };
  };
  showSmartBox: () => void;
  addPayWithApplePayButton?: () => void;
};

declare global {
  interface Window {
    ApplePaySession?: unknown;
    SmartBox?: {
      Checkout: AmwalCheckout;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

const SMARTBOX_INIT_TIMEOUT_MS = 8000;

export function isApplePaySupported(): boolean {
  return typeof window.ApplePaySession !== "undefined";
}

function waitForSmartBoxCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (window.SmartBox?.Checkout?.showSmartBox) {
        resolve();
        return;
      }
      if (Date.now() - started >= SMARTBOX_INIT_TIMEOUT_MS) {
        reject(new Error("AMWAL SmartBox failed to initialize"));
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

export function loadAmwalScript(url: string): Promise<void> {
  if (window.SmartBox?.Checkout?.showSmartBox) {
    return Promise.resolve();
  }
  if (scriptLoading) {
    return scriptLoading;
  }
  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-amwal-smartbox]");
    if (existing) {
      if (window.SmartBox?.Checkout?.showSmartBox) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => {
        void waitForSmartBoxCheckout().then(resolve).catch(reject);
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load AMWAL SmartBox")));
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.amwalSmartbox = "true";
    script.onload = () => {
      void waitForSmartBoxCheckout().then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Failed to load AMWAL SmartBox"));
    document.head.appendChild(script);
  }).finally(() => {
    scriptLoading = null;
  });
  return scriptLoading;
}

type AmwalCallbacks = {
  onComplete: (data: AmwalCallbackData) => void;
  onError: (data: AmwalCallbackData) => void;
  onCancel: () => void;
};

function buildConfigurePayload(config: AmwalSmartBoxConfig, callbacks: AmwalCallbacks, applePay = false) {
  const payload: Record<string, unknown> = {
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

  if (applePay) {
    if (config.request_source) {
      payload.RequestSource = config.request_source;
    }
    payload.ApplePayElementId = config.apple_pay_element_id || "apple_pay_button";
    if (config.required_billing_contact_fields?.length) {
      payload.RequiredBillingContactFields = config.required_billing_contact_fields;
    }
    if (config.required_shipping_contact_fields?.length) {
      payload.RequiredShippingContactFields = config.required_shipping_contact_fields;
    }
  }

  return payload;
}

async function configureCheckout(config: AmwalSmartBoxConfig, callbacks: AmwalCallbacks, applePay = false) {
  await loadAmwalScript(config.script_url);
  const checkout = window.SmartBox?.Checkout;
  if (!checkout?.showSmartBox) {
    throw new Error("AMWAL SmartBox is not available");
  }

  checkout.configure = buildConfigurePayload(config, callbacks, applePay);
  checkout.configure.SmartBoxColorConfig = { PrimaryColor: config.primary_color };

  if (applePay) {
    checkout.configure.isApplePayPageReadyCallback = (response: AmwalCallbackData) => {
      const nested = response as { data?: { canMakeApplePayPayments?: boolean } };
      if (!nested?.data?.canMakeApplePayPayments) {
        const element = document.getElementById(config.apple_pay_element_id || "apple_pay_button");
        if (element?.parentElement) {
          element.parentElement.style.display = "none";
        }
      }
    };
  }

  return checkout;
}

export async function openAmwalSmartBox(config: AmwalSmartBoxConfig, callbacks: AmwalCallbacks) {
  const checkout = await configureCheckout(config, callbacks, false);
  checkout.showSmartBox();
}

export async function mountAmwalApplePay(config: AmwalSmartBoxConfig, callbacks: AmwalCallbacks) {
  if (!config.apple_pay_enabled || !isApplePaySupported()) {
    return false;
  }

  const elementId = config.apple_pay_element_id || "apple_pay_button";
  if (!document.getElementById(elementId)) {
    return false;
  }

  const checkout = await configureCheckout(config, callbacks, true);
  if (typeof checkout.addPayWithApplePayButton !== "function") {
    return false;
  }

  const container = document.getElementById(elementId);
  if (container) {
    container.innerHTML = "";
  }

  checkout.addPayWithApplePayButton();
  return true;
}