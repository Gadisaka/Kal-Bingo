import axios from "axios";

const API_KEY = process.env.VERIFY_API_KEY;
const BASE_URL = process.env.VERIFY_API_BASE_URL || "https://verifyapi.leulzenebe.pro";

const PROVIDER_ALIASES = {
  telebirr: "telebirr",
  cbebirr: "cbebirr",
};

function normalizeProvider(provider) {
  return PROVIDER_ALIASES[String(provider || "").toLowerCase()] || null;
}

function extractTransactionId(provider, rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return "";
  const cleanToken = (token) =>
    String(token || "")
      .trim()
      .replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/gi, "")
      .toUpperCase();

  // Direct ID input support (users may still submit only the transaction ID)
  if (/^[A-Z0-9]{8,24}$/i.test(input)) {
    return cleanToken(input);
  }

  if (provider === "telebirr") {
    const candidates = [];

    const phraseMatch = input.match(
      /transaction\s+number\s+is\s*([A-Z0-9]{8,24})/i
    );
    if (phraseMatch?.[1]) candidates.push(cleanToken(phraseMatch[1]));

    const receiptMatch = input.match(/receipt\/([A-Z0-9]{8,24})/i);
    if (receiptMatch?.[1]) candidates.push(cleanToken(receiptMatch[1]));

    // Deduplicate while keeping order; prefer phrase match if present.
    const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
    if (uniqueCandidates.length) {
      return uniqueCandidates[0];
    }
  }

  if (provider === "cbebirr") {
    const patterns = [
      /txn\s*id\s*([A-Z0-9]{8,24})/i,
      /[?&]tid=([A-Z0-9]{8,24})/i,
      /transaction(?:\s*id)?\s*[:\-]?\s*([A-Z0-9]{8,24})/i,
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match?.[1]) {
        const token = cleanToken(match[1]);
        if (token) return token;
      }
    }
  }

  // Last-resort fallback: grab a plausible uppercase transaction token
  const fallback = input.match(/\b[A-Z]{2,6}[A-Z0-9]{6,24}\b/);
  return cleanToken(fallback?.[0] || "");
}

function extractPhoneNumberFromSms(rawInput) {
  const input = String(rawInput || "");
  if (!input) return "";

  const fromQueryParam = input.match(/[?&]PH=(251\d{9})/i);
  if (fromQueryParam?.[1]) return fromQueryParam[1];

  const genericE164Et = input.match(/\b251\d{9}\b/);
  if (genericE164Et?.[0]) return genericE164Et[0];

  return "";
}

function parseAmount(rawAmount) {
  if (rawAmount === undefined || rawAmount === null) return null;
  if (typeof rawAmount === "number" && Number.isFinite(rawAmount)) return rawAmount;

  const matched = String(rawAmount).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;

  const num = Number(matched[1]);
  return Number.isFinite(num) ? num : null;
}

function extractApiMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object") return "";

  return (
    payload.message ||
    payload.error ||
    payload.detail ||
    payload.reason ||
    payload.data?.message ||
    payload.data?.error ||
    ""
  );
}

/** Keys the upstream verify API may use for the credited account (receiver) name. */
const RECEIVER_NAME_KEYS = [
  "receiverName",
  "recipientName",
  "beneficiaryName",
  "toName",
  "payeeName",
  "receiverFullName",
  "creditAccountName",
  "accountName",
  "merchantName",
];

/** Keys the upstream verify API may use for the credited account phone. */
const RECEIVER_PHONE_KEYS = [
  "receiverPhone",
  "recipientPhone",
  "receiverPhoneNumber",
  "phoneNumber",
  "phone",
  "toPhone",
  "receiverMobile",
  "mobileNumber",
  "creditPhone",
  "receiverMsisdn",
];

function pickFirstNonEmptyString(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Collect receiver name/phone from a verify response (shape varies by provider/API version).
 */
function extractVerifiedReceiverInfo(nestedData, responseData) {
  const buckets = [
    nestedData,
    responseData,
    nestedData?.transaction,
    responseData?.transaction,
    nestedData?.data,
    responseData?.data,
    nestedData?.receiver,
    responseData?.receiver,
    nestedData?.recipient,
    responseData?.recipient,
    nestedData?.details,
    responseData?.details,
  ].filter((x) => x && typeof x === "object");

  let name = "";
  let phone = "";
  for (const obj of buckets) {
    if (!name) name = pickFirstNonEmptyString(obj, RECEIVER_NAME_KEYS);
    if (!phone) phone = pickFirstNonEmptyString(obj, RECEIVER_PHONE_KEYS);
    if (name && phone) break;
  }

  const nestedRx =
    nestedData?.receiver ||
    nestedData?.recipient ||
    responseData?.receiver ||
    responseData?.recipient;
  if (nestedRx && typeof nestedRx === "object") {
    if (!name && typeof nestedRx.name === "string" && nestedRx.name.trim()) {
      name = nestedRx.name.trim();
    }
    if (!phone) {
      phone =
        pickFirstNonEmptyString(nestedRx, RECEIVER_PHONE_KEYS) ||
        (typeof nestedRx.phone === "string" ? nestedRx.phone.trim() : "");
    }
  }

  return { name, phone };
}

function firstNameToken(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)[0]
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Compare configured account full name to verified name using the first name (first word).
 */
function firstNameMatches(expectedFullName, verifiedName) {
  const a = firstNameToken(expectedFullName);
  const b = firstNameToken(verifiedName);
  if (!a || !b) return false;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al === bl || bl.startsWith(al) || al.startsWith(bl);
}

/** Normalize to Ethiopia local 9 digits when possible (251…, 09…, or 9…). */
function normalizeEtLocalNineDigits(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("251")) {
    return digits.slice(-9);
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  if (digits.length === 9) {
    return digits;
  }
  if (digits.length > 9) {
    return digits.slice(-9);
  }
  return digits;
}

function receiverPhonesMatch(expectedPhone, verifiedPhone) {
  const e = normalizeEtLocalNineDigits(expectedPhone);
  const v = normalizeEtLocalNineDigits(verifiedPhone);
  if (!e || !v) return false;
  return e === v;
}

/**
 * When the caller provides expected receiver details, ensure the verified transaction matches.
 * @returns {{ ok: boolean, message?: string }}
 */
function validateReceiverAgainstPayload(payload, nestedData, responseData) {
  const expectedName = String(payload.receiverName || "").trim();
  const expectedPhone = String(
    payload.receiverAccountNumber || payload.telebirrPhoneNumber || ""
  ).trim();

  if (!expectedName && !expectedPhone) {
    return { ok: true };
  }

  const { name: verifiedName, phone: verifiedPhone } = extractVerifiedReceiverInfo(
    nestedData,
    responseData
  );

  if (expectedName) {
    if (!verifiedName) {
      return {
        ok: false,
        message:
          "Could not confirm the receiver name for this transaction. Please contact support or try again with the full SMS.",
      };
    }
    if (!firstNameMatches(expectedName, verifiedName)) {
      return {
        ok: false,
        message: "This payment was not sent to the correct receiver account (name mismatch).",
      };
    }
  }

  if (expectedPhone) {
    if (!verifiedPhone) {
      return {
        ok: false,
        message:
          "Could not confirm the receiver phone number for this transaction. Please contact support or try again with the full SMS.",
      };
    }
    if (!receiverPhonesMatch(expectedPhone, verifiedPhone)) {
      return {
        ok: false,
        message:
          "This payment was not sent to the correct receiver account (phone number mismatch).",
      };
    }
  }

  return { ok: true };
}

/**
 * Verify a transaction from Telebirr or CBE Birr
 *
 * @param {"telebirr" | "cbebirr"} provider - The payment provider
 * @param {Object} payload - Transaction details
 * @param {string} payload.referenceId - Transaction reference ID OR full SMS text
 * @param {string|number} payload.receivedAmount - Amount received
 * @param {string} payload.receiverName - Receiver's name
 * @param {string} payload.receiverAccountNumber - Receiver phone number
 *
 * @returns {Promise<Object>} - API response
 */
async function verifyTransaction(provider, payload) {
  let extractedReference = "";
  let normalizedProvider = "";
  try {
    if (!API_KEY) {
      throw new Error("VERIFY_API_KEY is not configured");
    }

    normalizedProvider = normalizeProvider(provider);
    if (!normalizedProvider) {
      throw new Error("Provider must be 'telebirr' or 'cbebirr'");
    }

    let res;
    const transactionNumber = extractTransactionId(
      normalizedProvider,
      payload.referenceId
    );
    extractedReference = transactionNumber;
    if (!transactionNumber) {
      throw new Error("Could not extract transaction ID from the provided SMS");
    }
    console.log(
      `[verifyTransaction] provider=${normalizedProvider} extractedTransactionId=${transactionNumber}`
    );

    if (normalizedProvider === "cbebirr") {
      const extractedPhone = extractPhoneNumberFromSms(payload.referenceId);
      const configuredPhone = String(
        payload.receiverAccountNumber || payload.telebirrPhoneNumber || ""
      ).replace(/\D/g, "");
      const candidatePhones = Array.from(
        new Set([extractedPhone, configuredPhone].filter(Boolean))
      );

      if (!candidatePhones.length) {
        throw new Error("Receiver phone number is required for CBE Birr verification");
      }

      let lastError;
      for (const phoneNumber of candidatePhones) {
        try {
          res = await axios.post(
            `${BASE_URL}/verify-cbebirr`,
            {
              receiptNumber: transactionNumber,
              phoneNumber,
            },
            {
              headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json",
              },
            }
          );
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!res && lastError) {
        throw lastError;
      }
    } else {
      res = await axios.post(
        `${BASE_URL}/verify-telebirr`,
        {
          reference: transactionNumber,
        },
        {
          headers: {
            "x-api-key": API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const responseData = res.data || {};
    const nestedData = responseData.data && typeof responseData.data === "object"
      ? responseData.data
      : responseData;

    const normalizedAmount =
      parseAmount(nestedData.amount) ??
      parseAmount(nestedData.paidAmount) ??
      parseAmount(nestedData.totalPaidAmount) ??
      parseAmount(payload.receivedAmount) ??
      0;

    const isSuccess =
      typeof responseData.success === "boolean"
        ? responseData.success
        : String(nestedData.transactionStatus || "").toLowerCase() === "completed";

    if (!isSuccess) {
      const message =
        extractApiMessage(responseData) ||
        extractApiMessage(nestedData) ||
        "Transaction verification failed";

      return {
        success: false,
        message,
        referenceId: transactionNumber,
        data: responseData,
        raw: responseData,
      };
    }

    const receiverCheck = validateReceiverAgainstPayload(
      payload,
      nestedData,
      responseData
    );
    if (!receiverCheck.ok) {
      return {
        success: false,
        message: receiverCheck.message || "Receiver details do not match the configured deposit account",
        referenceId: transactionNumber,
        data: responseData,
        raw: responseData,
      };
    }

    return {
      success: isSuccess,
      message: extractApiMessage(responseData),
      referenceId: transactionNumber,
      data: {
        ...nestedData,
        amount: normalizedAmount,
      },
      raw: responseData,
    };
  } catch (err) {
    const apiErrorPayload = err.response?.data;
    const apiMessage = extractApiMessage(apiErrorPayload);
    const detailedMessage = apiMessage || err.message || "Transaction verification failed";
    console.error(
      `[verifyTransaction] failed provider=${normalizedProvider || "unknown"} ref=${extractedReference || "none"} status=${err.response?.status || "n/a"} message=${detailedMessage}`
    );

    return {
      success: false,
      message: detailedMessage,
      referenceId: extractedReference || undefined,
      data: apiErrorPayload,
    };
  }
}

export { verifyTransaction };
