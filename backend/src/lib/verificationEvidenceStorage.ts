import {
  randomUUID,
} from "crypto";

import {
  supabaseAdmin,
  VERIFICATION_EVIDENCE_BUCKET,
} from "./supabaseAdmin";

const EXTENSIONS_BY_MIME_TYPE:
  Record<
    string,
    string
  > = {
    "image/jpeg":
      "jpg",

    "image/png":
      "png",

    "image/webp":
      "webp",

    "application/pdf":
      "pdf",
  };

export type StoredVerificationEvidence = {
  storageKey:
    string;

  mimeType:
    string;

  fileSizeBytes:
    number;
};

export async function storeVerificationEvidence({
  userId,
  appealId,
  evidenceLabel,
  file,
}: {
  userId:
    string;

  appealId:
    string;

  evidenceLabel:
    string;

  file:
    Express.Multer.File;
}): Promise<StoredVerificationEvidence> {
  const extension =
    EXTENSIONS_BY_MIME_TYPE[
      file.mimetype
    ];

  if (!extension) {
    throw new Error(
      "Unsupported verification evidence MIME type."
    );
  }

  /*
   * Never use the uploaded filename
   * as part of the private storage path.
   *
   * The server generates the complete
   * path so users cannot control or
   * traverse storage locations.
   */
  const storageKey =
    `users/${userId}/appeals/${appealId}/${evidenceLabel}-${randomUUID()}.${extension}`;

  const {
    error,
  } =
    await supabaseAdmin.storage
      .from(
        VERIFICATION_EVIDENCE_BUCKET
      )
      .upload(
        storageKey,
        file.buffer,
        {
          contentType:
            file.mimetype,

          upsert:
            false,

          cacheControl:
            "0",
        }
      );

  if (error) {
    console.error(
      "Supabase verification evidence upload failed:",
      error
    );

    throw new Error(
      "Unable to store verification evidence."
    );
  }

  return {
    storageKey,

    mimeType:
      file.mimetype,

    fileSizeBytes:
      file.size,
  };
}

export async function deleteVerificationEvidence(
  storageKey:
    string
) {
  const {
    error,
  } =
    await supabaseAdmin.storage
      .from(
        VERIFICATION_EVIDENCE_BUCKET
      )
      .remove([
        storageKey,
      ]);

  if (error) {
    console.error(
      "Supabase verification evidence deletion failed:",
      error
    );

    throw new Error(
      "Unable to remove verification evidence."
    );
  }
}