import "dotenv/config";

import {
  createFulfillmentCodeMaterial,
  decryptFulfillmentCode,
  encryptFulfillmentCode,
  generateFulfillmentCode,
  hashFulfillmentCode,
  isValidFulfillmentCode,
  verifyFulfillmentCodeHash,
} from "../src/services/fulfillmentCode.service";

/*
 * =======================================================
 * TEST HELPERS
 * =======================================================
 */

let passed =
  0;

let failed =
  0;

function check(
  condition: boolean,
  label: string
) {
  if (
    condition
  ) {
    passed +=
      1;

    console.log(
      `PASS: ${label}`
    );

    return;
  }

  failed +=
    1;

  console.error(
    `FAIL: ${label}`
  );
}

function expectThrow(
  callback: () => unknown,
  label: string
) {
  try {
    callback();

    check(
      false,
      label
    );
  } catch {
    check(
      true,
      label
    );
  }
}

/*
 * =======================================================
 * MAIN TEST
 * =======================================================
 */

function main() {
  /*
   * =====================================================
   * 1. GENERATED CODE IS FOUR DIGITS
   * =====================================================
   */

  const generatedCode =
    generateFulfillmentCode();

  check(
    /^\d{4}$/.test(
      generatedCode
    ),
    "Generated fulfilment code is exactly four digits"
  );

  /*
   * =====================================================
   * 2. VALIDATION ACCEPTS LEADING ZEROES
   * =====================================================
   */

  check(
    isValidFulfillmentCode(
      "0007"
    ),
    "Four-digit code with leading zeroes is valid"
  );

  /*
   * =====================================================
   * 3. INVALID CODE FORMATS ARE REJECTED
   * =====================================================
   */

  check(
    !isValidFulfillmentCode(
      "123"
    ) &&
      !isValidFulfillmentCode(
        "12345"
      ) &&
      !isValidFulfillmentCode(
        "12a4"
      ) &&
      !isValidFulfillmentCode(
        1234
      ),
    "Invalid fulfilment-code formats are rejected"
  );

  /*
   * =====================================================
   * 4. HASH IS NOT THE RAW CODE
   * =====================================================
   */

  const testCode =
    "4821";

  const codeHash =
    hashFulfillmentCode(
      testCode
    );

  check(
    codeHash !==
      testCode &&
      codeHash.length >
        testCode.length,
    "Fulfilment code is stored as a non-plain-text hash"
  );

  /*
   * =====================================================
   * 5. CORRECT CODE VERIFIES
   * =====================================================
   */

  check(
    verifyFulfillmentCodeHash(
      testCode,
      codeHash
    ),
    "Correct fulfilment code verifies against stored hash"
  );

  /*
   * =====================================================
   * 6. WRONG CODE DOES NOT VERIFY
   * =====================================================
   */

  check(
    !verifyFulfillmentCodeHash(
      "4822",
      codeHash
    ),
    "Incorrect fulfilment code is rejected"
  );

  /*
   * =====================================================
   * 7. ENCRYPTION ROUND-TRIP WORKS
   * =====================================================
   */

  const ciphertext =
    encryptFulfillmentCode(
      testCode
    );

  const decrypted =
    decryptFulfillmentCode(
      ciphertext
    );

  check(
    decrypted ===
      testCode &&
      ciphertext !==
        testCode,
    "Encrypted fulfilment code decrypts back to original value"
  );

  /*
   * =====================================================
   * 8. LEADING ZEROES SURVIVE ENCRYPTION
   * =====================================================
   */

  const leadingZeroCode =
    "0042";

  const leadingZeroCiphertext =
    encryptFulfillmentCode(
      leadingZeroCode
    );

  check(
    decryptFulfillmentCode(
      leadingZeroCiphertext
    ) ===
      leadingZeroCode,
    "Leading zeroes survive encryption and decryption"
  );

  /*
   * =====================================================
   * 9. TAMPERED CIPHERTEXT IS REJECTED
   * =====================================================
   */

  const tamperedParts =
    ciphertext.split(
      "."
    );

  tamperedParts[3] =
    tamperedParts[3]
      .slice(
        0,
        -2
      ) +
    "AA";

  const tamperedCiphertext =
    tamperedParts.join(
      "."
    );

  expectThrow(
    () =>
      decryptFulfillmentCode(
        tamperedCiphertext
      ),
    "Tampered encrypted fulfilment code is rejected"
  );

  /*
   * =====================================================
   * 10. COMPLETE MATERIAL IS INTERNALLY CONSISTENT
   * =====================================================
   */

  const material =
    createFulfillmentCodeMaterial();

  check(
    isValidFulfillmentCode(
      material.code
    ) &&
      verifyFulfillmentCodeHash(
        material.code,
        material.codeHash
      ) &&
      decryptFulfillmentCode(
        material.codeCiphertext
      ) ===
        material.code,
    "Generated fulfilment material contains matching code, hash and ciphertext"
  );

  /*
   * =====================================================
   * 11. INVALID ENCRYPTION INPUT IS REJECTED
   * =====================================================
   */

  expectThrow(
    () =>
      encryptFulfillmentCode(
        "999"
      ),
    "Encryption rejects malformed fulfilment codes"
  );

  /*
   * =====================================================
   * 12. INVALID CIPHERTEXT FORMAT IS REJECTED
   * =====================================================
   */

  expectThrow(
    () =>
      decryptFulfillmentCode(
        "not-valid-ciphertext"
      ),
    "Malformed ciphertext is rejected"
  );

  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `Fulfilment code tests: ${passed} passed, ${failed} failed`
  );

  console.log(
    "=============================================="
  );

  if (
    failed >
    0
  ) {
    process.exitCode =
      1;
  }
}

try {
  main();
} catch (
  error
) {
  console.error(
    "Fulfilment code test crashed:",
    error
  );

  process.exitCode =
    1;
}
