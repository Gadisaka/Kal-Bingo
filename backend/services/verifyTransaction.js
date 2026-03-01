import axios from "axios";

const API_KEY = "Ridofc3258SYFUHG8LG7ADEES2402T245MLQZHCA";
// const BASE_URL = "https://ex.pro.et";
const BASE_URL = "https://payment.offsetsoftware.dev";

/**
 * Verify a transaction from Telebirr or CBE
 *
 * @param {"telebirr" | "cbe"} provider - The payment provider
 * @param {Object} payload - Transaction details
 * @param {string} payload.referenceId - Transaction reference ID
 * @param {string|number} payload.receivedAmount - Amount received
 * @param {string} payload.receiverName - Receiver's name
 * @param {string} payload.receiverAccountNumber - Phone number (telebirr) or bank account (cbe)
 * @param {string} [payload.payerAccountNumber] - Payer account (cbe) or phone (telebirr). For cbe, pass "none" if not available.
 *
 * @returns {Promise<Object>} - API response
 */
async function verifyTransaction(provider, payload) {
  try {
    if (!["telebirr", "cbe"].includes(provider)) {
      throw new Error("Provider must be 'telebirr', 'cbe'");
    }

    let res;

    let transactionNumber = payload.referenceId;
    // For CBE only: if FT id is 12 digits, append last 8 of sender account
    // Note: Telebirr transaction IDs are 10-character alphanumeric (e.g., "CIB1REEW6N") and used as-is
    if (provider === "cbe" && transactionNumber.length === 12) {
      if (
        payload.payerAccountNumber &&
        payload.payerAccountNumber.length === 13
      ) {
        const last8 = payload.payerAccountNumber.slice(-8);
        transactionNumber = transactionNumber + last8;
      }
    }

    if (provider === "cbe") {
      res = await axios.post(
        `${BASE_URL}/api/cbe/validate/${transactionNumber}`,
        {
          cbeAccountNumber: payload.receiverAccountNumber,
          cbeReceiverName: payload.receiverName,
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      res = await axios.post(
        `${BASE_URL}/api/telebirr/validate/${transactionNumber}`,
        {
          telebirrPhoneNumber:
            payload.telebirrPhoneNumber || payload.receiverAccountNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return res.data;
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || err.message,
      data: err.response?.data,
    };
  }
}

export { verifyTransaction };
