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

  // Direct ID input support (users may still submit only the transaction ID)
  if (/^[A-Z0-9]{8,24}$/i.test(input)) {
    return input.toUpperCase();
  }

  const patternsByProvider = {
    telebirr: [
      /transaction number is\s*([A-Z0-9]{8,24})/i,
      /receipt\/([A-Z0-9]{8,24})/i,
      /txn(?:\s*id)?\s*[:\-]?\s*([A-Z0-9]{8,24})/i,
    ],
    cbebirr: [
      /txn\s*id\s*([A-Z0-9]{8,24})/i,
      /[?&]tid=([A-Z0-9]{8,24})/i,
      /transaction(?:\s*id)?\s*[:\-]?\s*([A-Z0-9]{8,24})/i,
    ],
  };

  const patterns = patternsByProvider[provider] || [];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  // Last-resort fallback: grab a plausible uppercase transaction token
  const fallback = input.match(/\b[A-Z]{2,6}[A-Z0-9]{6,24}\b/);
  return fallback?.[0]?.toUpperCase() || "";
}

function parseAmount(rawAmount) {
  if (rawAmount === undefined || rawAmount === null) return null;
  if (typeof rawAmount === "number" && Number.isFinite(rawAmount)) return rawAmount;

  const matched = String(rawAmount).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;

  const num = Number(matched[1]);
  return Number.isFinite(num) ? num : null;
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
  try {
    if (!API_KEY) {
      throw new Error("VERIFY_API_KEY is not configured");
    }

    const normalizedProvider = normalizeProvider(provider);
    if (!normalizedProvider) {
      throw new Error("Provider must be 'telebirr' or 'cbebirr'");
    }

    let res;
    const transactionNumber = extractTransactionId(
      normalizedProvider,
      payload.referenceId
    );
    if (!transactionNumber) {
      throw new Error("Could not extract transaction ID from the provided SMS");
    }

    if (normalizedProvider === "cbebirr") {
      const receiverPhone =
        payload.receiverAccountNumber || payload.telebirrPhoneNumber;
      if (!receiverPhone) {
        throw new Error("Receiver phone number is required for CBE Birr verification");
      }

      res = await axios.post(
        `${BASE_URL}/verify-cbebirr`,
        {
          receiptNumber: transactionNumber,
          phoneNumber: String(receiverPhone).replace(/\D/g, ""),
        },
        {
          headers: {
            "x-api-key": API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
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

    return {
      success: isSuccess,
      message: responseData.message,
      referenceId: transactionNumber,
      data: {
        ...nestedData,
        amount: normalizedAmount,
      },
      raw: responseData,
    };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || err.message,
      data: err.response?.data,
    };
  }
}

export { verifyTransaction };
