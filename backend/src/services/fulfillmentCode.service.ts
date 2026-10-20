import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";

/*
 * =======================================================
 * CONFIGURATION
 * =======================================================
 *
 * CampusMart uses one high-entropy environment secret and
 * derives separate keys for:
 *
 * - code verification
 * - code encryption
 *
 * Never log this secret.
 * Never expose it to the frontend.
 */

const CODE_LENGTH =
  4;

const CODE_PATTERN =
  /^\d{4}$/;

const ENCRYPTION_VERSION =
  "v1";

const IV_LENGTH =
  12;

function getMasterSecret() {
  const secret =
    process.env
      .FULFILLMENT_CODE_SECRET
      ?.trim();

  if (
    !secret ||
    secret.length <
      32
  ) {
    throw new Error(
      "FULFILLMENT_CODE_SECRET must be configured with at least 32 characters."
    );
  }

  return secret;
}

/*
 * =======================================================
 * KEY DERIVATION
 * =======================================================
 *
 * We deliberately derive separate cryptographic keys from
 * the same master secret so encryption and verification do
 * not use identical key material.
 */

function getEncryptionKey() {
  return createHash(
    "sha256"
  )
    .update(
      `${getMasterSecret()}:campusmart:fulfillment:encryption`
    )
    .digest();
}

function getHashKey() {
  return createHash(
    "sha256"
  )
    .update(
      `${getMasterSecret()}:campusmart:fulfillment:hash`
    )
    .digest();
}

/*
 * =======================================================
 * CODE VALIDATION
 * =======================================================
 */

export function isValidFulfillmentCode(
  value: unknown
): value is string {
  return (
    typeof value ===
      "string" &&
    CODE_PATTERN.test(
      value
    )
  );
}

/*
 * =======================================================
 * GENERATE CODE
 * =======================================================
 *
 * randomInt uses Node's cryptographically secure random
 * source.
 *
 * Examples:
 *
 * 0007
 * 0419
 * 5821
 * 9999
 *
 * Leading zeroes are intentionally preserved.
 */

export function generateFulfillmentCode() {
  const upperBound =
    10 **
    CODE_LENGTH;

  return String(
    randomInt(
      0,
      upperBound
    )
  ).padStart(
    CODE_LENGTH,
    "0"
  );
}

/*
 * =======================================================
 * HASH CODE
 * =======================================================
 *
 * Because a 4-digit code has only 10,000 possibilities,
 * a plain SHA hash would be inappropriate.
 *
 * We use a keyed HMAC so someone who obtains only the
 * database cannot cheaply precompute all possible codes
 * without also obtaining the server secret.
 */

export function hashFulfillmentCode(
  code: string
) {
  if (
    !isValidFulfillmentCode(
      code
    )
  ) {
    throw new Error(
      "INVALID_FULFILLMENT_CODE"
    );
  }

  return createHmac(
    "sha256",
    getHashKey()
  )
    .update(
      code
    )
    .digest(
      "hex"
    );
}

/*
 * =======================================================
 * VERIFY CODE HASH
 * =======================================================
 *
 * Uses a timing-safe comparison.
 */

export function verifyFulfillmentCodeHash(
  code: string,
  storedHash: string
) {
  if (
    !isValidFulfillmentCode(
      code
    ) ||
    typeof storedHash !==
      "string" ||
    !storedHash
  ) {
    return false;
  }

  const candidateHash =
    hashFulfillmentCode(
      code
    );

  const candidateBuffer =
    Buffer.from(
      candidateHash,
      "hex"
    );

  let storedBuffer:
    Buffer;

  try {
    storedBuffer =
      Buffer.from(
        storedHash,
        "hex"
      );
  } catch {
    return false;
  }

  if (
    candidateBuffer.length !==
    storedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    candidateBuffer,
    storedBuffer
  );
}

/*
 * =======================================================
 * ENCRYPT CODE
 * =======================================================
 *
 * AES-256-GCM provides authenticated encryption.
 *
 * Stored format:
 *
 * v1.<iv>.<authTag>.<ciphertext>
 *
 * All binary parts are base64 encoded.
 */

export function encryptFulfillmentCode(
  code: string
) {
  if (
    !isValidFulfillmentCode(
      code
    )
  ) {
    throw new Error(
      "INVALID_FULFILLMENT_CODE"
    );
  }

  const iv =
    randomBytes(
      IV_LENGTH
    );

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        code,
        "utf8"
      ),

      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,

    iv.toString(
      "base64"
    ),

    authTag.toString(
      "base64"
    ),

    encrypted.toString(
      "base64"
    ),
  ].join(
    "."
  );
}

/*
 * =======================================================
 * DECRYPT CODE
 * =======================================================
 *
 * This function must only be used by trusted backend code.
 *
 * Later:
 *
 * buyer endpoint  -> may call this
 * seller endpoint -> must NOT call this
 */

export function decryptFulfillmentCode(
  payload: string
) {
  if (
    typeof payload !==
      "string" ||
    !payload
  ) {
    throw new Error(
      "INVALID_FULFILLMENT_CIPHERTEXT"
    );
  }

  const parts =
    payload.split(
      "."
    );

  if (
    parts.length !==
      4 ||
    parts[0] !==
      ENCRYPTION_VERSION
  ) {
    throw new Error(
      "INVALID_FULFILLMENT_CIPHERTEXT"
    );
  }

  const [
    ,
    ivEncoded,
    authTagEncoded,
    ciphertextEncoded,
  ] =
    parts;

  try {
    const iv =
      Buffer.from(
        ivEncoded,
        "base64"
      );

    const authTag =
      Buffer.from(
        authTagEncoded,
        "base64"
      );

    const ciphertext =
      Buffer.from(
        ciphertextEncoded,
        "base64"
      );

    if (
      iv.length !==
      IV_LENGTH
    ) {
      throw new Error(
        "INVALID_IV"
      );
    }

    const decipher =
      createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        iv
      );

    decipher.setAuthTag(
      authTag
    );

    const decrypted =
      Buffer.concat([
        decipher.update(
          ciphertext
        ),

        decipher.final(),
      ]).toString(
        "utf8"
      );

    if (
      !isValidFulfillmentCode(
        decrypted
      )
    ) {
      throw new Error(
        "INVALID_CODE"
      );
    }

    return decrypted;
  } catch {
    throw new Error(
      "INVALID_FULFILLMENT_CIPHERTEXT"
    );
  }
}

/*
 * =======================================================
 * CREATE COMPLETE CODE MATERIAL
 * =======================================================
 *
 * Use this whenever a new seller fulfilment challenge is
 * created.
 *
 * IMPORTANT:
 *
 * `code` is returned only so trusted backend logic can
 * optionally use it during the current request.
 *
 * Do not place it in seller-facing responses.
 */

export function createFulfillmentCodeMaterial() {
  const code =
    generateFulfillmentCode();

  return {
    code,

    codeHash:
      hashFulfillmentCode(
        code
      ),

    codeCiphertext:
      encryptFulfillmentCode(
        code
      ),
  };
}