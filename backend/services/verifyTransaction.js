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
