"use client";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";


import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

type RosterStatus =
  | "processing"
  | "active"
  | "archived"
  | "failed";

type RosterPreview = {
  valid: boolean;

  headers: string[];

  totalDataRows: number;

  acceptedRecordCount: number;

  rejectedRowCount: number;

  activeRecordCount: number;

  inactiveRecordCount: number;

  fileErrors: {
    code: string;

    message: string;
  }[];

  rejectedRows: {
    sourceRowNumber: number;

    code: string;

    message: string;

    matricNumber?:
      | string
      | null;
  }[];

  rejectedRowsTruncated: boolean;
  overlap?: {
    newMatricNumbers: number;
    alreadyInOtherSources: number;
    conflicts: number;
  };
};

type ActiveRoster = {
  id: string;

  status: RosterStatus;

  academicSession: string;

  sourceIssuer: string;

  sourceReference?:
    | string
    | null;

  originalFileName: string;

  validFrom?:
    | string
    | null;

  expiresAt?:
    | string
    | null;

  recordCount: number;

  activeRecordCount: number;

  inactiveRecordCount: number;

  importedAt: string;

  activatedAt?:
    | string
    | null;
  rosterScope?: string;
  trustedForAutomatedVerification?: boolean;

  importedByAdmin?:
    | {
        id: string;

        name: string;

        role: string;
      }
    | null;
};

type RosterHistoryItem = {
  id: string;

  status: RosterStatus;
  rosterScope?: string;
  sourceUnit?: string | null;
  trustedForAutomatedVerification?: boolean;

  academicSession: string;

  sourceIssuer: string;

  sourceReference?:
    | string
    | null;

  originalFileName: string;

  validFrom?:
    | string
    | null;

  expiresAt?:
    | string
    | null;

  recordCount: number;

  activeRecordCount: number;

  inactiveRecordCount: number;

  rejectedRowCount: number;

  importedAt: string;

  activatedAt?:
    | string
    | null;

  archivedAt?:
    | string
    | null;

  failureReason?:
    | string
    | null;

  importedByAdmin?:
    | {
        id: string;

        name: string;

        email: string;

        role: string;
      }
    | null;
};

type ImportMetadata = {
  academicSession: string;

  sourceIssuer: string;

  sourceReference: string;

  validFrom: string;

  expiresAt: string;
};

const EMPTY_METADATA:
  ImportMetadata = {
    academicSession: "",

    sourceIssuer: "",

    sourceReference: "",

    validFrom: "",

    expiresAt: "",
  };

function formatDate(
  value?:
    | string
    | null
) {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not set";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

function formatDateTime(
  value?:
    | string
    | null
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function formatFileSize(
  bytes:
    number
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(
    1
  )} MB`;
}

function statusClasses(
  status:
    RosterStatus
) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "processing":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function statusLabel(
  status:
    RosterStatus
) {
  switch (status) {
    case "active":
      return "Active";

    case "archived":
      return "Archived";

    case "processing":
      return "Processing";

    case "failed":
      return "Failed";

    default:
      return status;
  }
}

export default function UniversityRosterPanel({
  universityId,
  onCertificationChanged,
}: {
  universityId: string;
  onCertificationChanged?: () => void;
}) {
  const campusMartConfirm = useCampusMartConfirm();

  const router =
    useRouter();

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    preview,
    setPreview,
  ] =
    useState<RosterPreview | null>(
      null
    );

  const [
    metadata,
    setMetadata,
  ] =
    useState<ImportMetadata>(
      EMPTY_METADATA
    );

  const [
    activeRoster,
    setActiveRoster,
  ] =
    useState<ActiveRoster | null>(
      null
    );
  const [sourceAction, setSourceAction] = useState<{id:string; action:"certify"|"archive"}|null>(null);
  const [sourceReason, setSourceReason] = useState("");
  const [sourceScope, setSourceScope] = useState<"institution"|"faculty"|"department">("department");
  const [sourceUnit, setSourceUnit] = useState("");
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);


  const [
    history,
    setHistory,
  ] =
    useState<
      RosterHistoryItem[]
    >([]);

  const [
    loadingData,
    setLoadingData,
  ] =
    useState(
      true
    );

  const [
    previewing,
    setPreviewing,
  ] =
    useState(
      false
    );

  const [
    importing,
    setImporting,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    notice,
    setNotice,
  ] =
    useState(
      ""
    );

  const getAdminToken =
    useCallback(
      () => {
        const token =
          sessionStorage.getItem(
            ADMIN_TOKEN_KEY
          );

        if (!token) {
          router.replace(
            "/admin/login"
          );

          return null;
        }

        return token;
      },
      [
        router,
      ]
    );

  const handleUnauthorized =
    useCallback(
      () => {
        sessionStorage.removeItem(
          ADMIN_TOKEN_KEY
        );

        router.replace(
          "/admin/login"
        );
      },
      [
        router,
      ]
    );

  const loadRosterData =
    useCallback(
      async (
        showLoading =
          true
      ) => {
        if (
          !universityId
        ) {
          return;
        }

        const token =
          getAdminToken();

        if (!token) {
          return;
        }

        if (
          showLoading
        ) {
          setLoadingData(
            true
          );
        }

        setError(
          ""
        );

        try {
          const [
            activeResponse,
            historyResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/admin/universities/${universityId}/rosters/active`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },

                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${API_URL}/api/admin/universities/${universityId}/rosters`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },

                  cache:
                    "no-store",
                }
              ),
            ]);

          if (
            activeResponse.status ===
              401 ||
            historyResponse.status ===
              401
          ) {
            handleUnauthorized();

            return;
          }

          const [
            activeData,
            historyData,
          ] =
            await Promise.all([
              activeResponse
                .json()
                .catch(
                  () =>
                    null
                ),

              historyResponse
                .json()
                .catch(
                  () =>
                    null
                ),
            ]);

          if (
            !activeResponse.ok ||
            !activeData?.success
          ) {
            throw new Error(
              activeData?.message ||
                "Unable to load the active university roster."
            );
          }

          if (
            !historyResponse.ok ||
            !historyData?.success
          ) {
            throw new Error(
              historyData?.message ||
                "Unable to load roster import history."
            );
          }

          setActiveRoster(
            activeData.rosterImport ??
              null
          );

          setHistory(
            Array.isArray(
              historyData.imports
            )
              ? historyData.imports
              : []
          );
        } catch (
          requestError
        ) {
          console.error(
            "Load university roster data failed:",
            requestError
          );

          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load university roster information."
          );
        } finally {
          if (
            showLoading
          ) {
            setLoadingData(
              false
            );
          }
        }
      },
      [
        universityId,
        getAdminToken,
        handleUnauthorized,
      ]
    );

  useEffect(() => {
    void loadRosterData();
  }, [
    loadRosterData,
  ]);

  const canImport =
    useMemo(
      () => {
        return Boolean(
          selectedFile &&
            preview?.valid &&
            metadata
              .academicSession
              .trim() &&
            metadata
              .sourceIssuer
              .trim()
        );
      },
      [
        selectedFile,
        preview,
        metadata,
      ]
    );

  const clearSelection =
    () => {
      setSelectedFile(
        null
      );

      setPreview(
        null
      );

      setError(
        ""
      );

      setNotice(
        ""
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  const chooseFile =
    (
      file:
        File | null
    ) => {
      setNotice(
        ""
      );

      setError(
        ""
      );

      setPreview(
        null
      );

      if (!file) {
        setSelectedFile(
          null
        );

        return;
      }

      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".csv"
          )
      ) {
        setSelectedFile(
          null
        );

        setError(
          "Choose a CSV file."
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }

        return;
      }

      if (
        file.size >
        10 * 1024 * 1024
      ) {
        setSelectedFile(
          null
        );

        setError(
          "University roster CSV files must be 10 MB or smaller."
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }

        return;
      }

      setSelectedFile(
        file
      );
    };

  const [currentStudentsOnly, setCurrentStudentsOnly] = useState(false);

  const previewRoster =
    async () => {
      if (
        !selectedFile
      ) {
        setError(
          "Choose a roster CSV first."
        );

        return;
      }

      const token =
        getAdminToken();

      if (!token) {
        return;
      }

      setPreviewing(
        true
      );

      setError(
        ""
      );

      setNotice(
        ""
      );

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          selectedFile
        );
        formData.append("currentStudentsOnly", currentStudentsOnly ? "true" : "false");

        const response =
          await fetch(
            `${API_URL}/api/admin/universities/${universityId}/rosters/preview`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body:
                formData,
            }
          );

        if (
          response.status ===
          401
        ) {
          handleUnauthorized();

          return;
        }

        const data =
          await response
            .json()
            .catch(
              () =>
                null
            );

        if (
          !response.ok ||
          !data?.success ||
          !data.preview
        ) {
          throw new Error(
            data?.message ||
              "Unable to preview this roster."
          );
        }

        setPreview(
          data.preview as
            RosterPreview
        );

        if (
          data.preview.valid
        ) {
          setNotice(
            "Roster passed validation. Review the counts and import metadata before activating it."
          );
        } else {
          setNotice(
            ""
          );
        }
      } catch (
        requestError
      ) {
        console.error(
          "Preview roster failed:",
          requestError
        );

        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to preview this roster."
        );
      } finally {
        setPreviewing(
          false
        );
      }
    };

  const importRoster =
    async () => {
      if (
        !selectedFile
      ) {
        setError(
          "Choose a roster CSV first."
        );

        return;
      }

      if (
        !preview?.valid
      ) {
        setError(
          "Preview the roster and resolve all validation errors before importing."
        );

        return;
      }

      const academicSession =
        metadata
          .academicSession
          .trim();

      const sourceIssuer =
        metadata
          .sourceIssuer
          .trim();

      const sourceReference =
        metadata
          .sourceReference
          .trim();

      if (
        !academicSession
      ) {
        setError(
          "Academic session is required."
        );

        return;
      }

      if (
        !sourceIssuer
      ) {
        setError(
          "Roster issuer or source is required."
        );

        return;
      }

      if (
        metadata.validFrom &&
        metadata.expiresAt
      ) {
        const validFrom =
          new Date(
            `${metadata.validFrom}T00:00:00`
          );

        const expiresAt =
          new Date(
            `${metadata.expiresAt}T23:59:59`
          );

        if (
          validFrom.getTime() >
          expiresAt.getTime()
        ) {
          setError(
            "Expiry must be later than the valid-from date."
          );

          return;
        }
      }

      const confirmation = "Import and activate this independent roster source? Existing active CSVs will be preserved. This upload alone does not authorise automatic student verification.";

      if (
        !await campusMartConfirm({ title: "Confirm action", description: confirmation, danger: false })
      ) {
        return;
      }

      const token =
        getAdminToken();

      if (!token) {
        return;
      }

      setImporting(
        true
      );

      setError(
        ""
      );

      setNotice(
        ""
      );

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          selectedFile
        );
        formData.append("currentStudentsOnly", currentStudentsOnly ? "true" : "false");

        formData.append(
          "academicSession",
          academicSession
        );

        formData.append(
          "sourceIssuer",
          sourceIssuer
        );

        if (
          sourceReference
        ) {
          formData.append(
            "sourceReference",
            sourceReference
          );
        }

        if (
          metadata.validFrom
        ) {
          formData.append(
            "validFrom",
            `${metadata.validFrom}T00:00:00`
          );
        }

        if (
          metadata.expiresAt
        ) {
          formData.append(
            "expiresAt",
            `${metadata.expiresAt}T23:59:59`
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/admin/universities/${universityId}/rosters`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body:
                formData,
            }
          );

        if (
          response.status ===
          401
        ) {
          handleUnauthorized();

          return;
        }

        const data =
          await response
            .json()
            .catch(
              () =>
                null
            );

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Unable to import this university roster."
          );
        }

        setNotice(
          data.message ||
            "University roster imported successfully."
        );

        setSelectedFile(
          null
        );

        setPreview(
          null
        );

        setMetadata({
          ...EMPTY_METADATA,
        });

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }

        await loadRosterData(
          false
        );
      } catch (
        requestError
      ) {
        console.error(
          "Import university roster failed:",
          requestError
        );

        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to import this university roster."
        );
      } finally {
        setImporting(
          false
        );
      }
    };

  const applySourceAction = async () => {
    if (!sourceAction || sourceBusy || sourceReason.trim().length < 20 || !sourceConfirmed) return;
    if (sourceAction.action === "certify" && sourceScope !== "institution" && sourceUnit.trim().length < 3) return;
    const selected = history.find((item) => item.id === sourceAction.id);
    if (!selected || selected.status !== "active") return;
    const approved = await campusMartConfirm({
      title: sourceAction.action === "archive" ? "Archive roster source" : "Certify student roster source",
      description: sourceAction.action === "archive"
        ? `Archive ${selected.originalFileName}? This removes its contribution to automatic verification, while preserving audit history and all other active rosters.\n\nReason: ${sourceReason}`
        : `Certify ${selected.originalFileName} for ${sourceScope} matching?\nScope: ${sourceUnit || "Whole institution"}\n\nOnly certify a genuinely authorised student register, not an attendance sheet.\n\nReason: ${sourceReason}`,
      confirmLabel: sourceAction.action === "archive" ? "Archive source" : "Certify source",
      danger: sourceAction.action === "archive",
    });
    if (!approved) return;
    setSourceBusy(true); setError(""); setNotice("");
    try {
      const url = `${API_URL}/api/admin/universities/${universityId}/rosters/${sourceAction.id}/${sourceAction.action === "archive" ? "archive" : "enable-verification"}`;
      const response = await fetch(url, {
        method:"POST",
        headers:{Authorization:`Bearer ${getAdminToken() || ""}`,"Content-Type":"application/json"},
        body:JSON.stringify(sourceAction.action === "archive"
          ? {reason:sourceReason.trim(),confirmed:true}
          : {reason:sourceReason.trim(),officialSourceConfirmed:true,scope:sourceScope,sourceUnit:sourceUnit.trim()}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Source operation failed.");
      setNotice(sourceAction.action === "archive" ? "Source archived. Other active rosters are unchanged." : "Source certified. Matching uses all eligible, valid sources and blocks conflicts.");
      setSourceAction(null); setSourceReason(""); setSourceConfirmed(false); setSourceUnit("");
      await loadRosterData(false);
      onCertificationChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update source.");
    } finally { setSourceBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          University data source
        </p>

        <h2 className="mt-2 text-xl font-bold text-slate-950">
          Student roster import
        </h2>
        <div className="my-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <strong>Multiple roster sources.</strong> Each CSV stays active independently until archived.
          Use the source list below to certify a genuine institution, faculty or departmental register.
          A certified departmental source only confirms identities actually present in that source.
          Disagreements between trusted sources require manual investigation.
        </div>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Import a private university-supplied CSV for
          automated student verification. CampusMart
          validates the entire roster before activation
          and does not expose individual roster records
          through this Admin page.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-950">
          Imported CSVs require separate source certification
        </p>

        <p className="mt-1 text-sm leading-6 text-amber-800">
          Uploading a CSV preserves existing sources. Only specifically approved, current rosters are used automatically. Any conflicting student details stop automatic approval.
        </p>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-700">
          {notice}
        </div>
      ) : null}

      {loadingData ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

          <p className="mt-3 text-sm font-semibold text-slate-500">
            Loading roster information...
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-slate-200 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Current source
                </p>

                <h3 className="mt-2 text-lg font-bold text-slate-950">
                  Most recent active source ({history.filter(item => item.status === "active").length} active)
                </h3>
              </div>

              {activeRoster ? (
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusClasses(
                    activeRoster.status
                  )}`}
                >
                  {statusLabel(
                    activeRoster.status
                  )}
                </span>
              ) : null}
            </div>

            {activeRoster ? (
              <div className="mt-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">
                      Academic session
                    </p>

                    <p className="mt-1 font-bold text-slate-950">
                      {
                        activeRoster.academicSession
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">
                      Total records
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {
                        activeRoster.recordCount
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold text-emerald-700">
                      Active students
                    </p>

                    <p className="mt-1 text-xl font-black text-emerald-900">
                      {
                        activeRoster.activeRecordCount
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-4">
                    <p className="text-xs font-semibold text-slate-600">
                      Inactive students
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-900">
                      {
                        activeRoster.inactiveRecordCount
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Issuer
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {
                        activeRoster.sourceIssuer
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      File
                    </p>

                    <p className="mt-1 break-all font-semibold text-slate-800">
                      {
                        activeRoster.originalFileName
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Valid from
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {formatDate(
                        activeRoster.validFrom
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Expires
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {formatDate(
                        activeRoster.expiresAt
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No active roster sources are currently available.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                New import
              </p>

              <h3 className="mt-2 text-lg font-bold text-slate-950">
                Upload roster CSV
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Required: matric number and either a full name or separate first/last names. Student status is recommended but can be covered by an attested current-student roster.
                {" "}
                <span className="font-mono font-semibold">
                  matric_number
                </span>
                ,{" "}
                <span className="font-mono font-semibold">
                  full_name
                </span>
                ,{" "}
                <span className="font-mono font-semibold">
                  student_status
                </span>
                .{" "}
                <span className="font-mono font-semibold">
                  institutional_email
                </span>{" "}
                is optional.
              </p>
            </div>

            <div className="mt-5">
              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept=".csv,text/csv"
                onChange={(
                  event
                ) =>
                  chooseFile(
                    event.target
                      .files?.[0] ??
                      null
                  )
                }
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
              />
            </div>

            {selectedFile ? (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="break-all text-sm font-bold text-slate-900">
                    {
                      selectedFile.name
                    }
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatFileSize(
                      selectedFile.size
                    )}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      previewing ||
                      importing
                    }
                    onClick={
                      clearSelection
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    disabled={
                      previewing ||
                      importing
                    }
                    onClick={() =>
                      void previewRoster()
                    }
                    className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {previewing
                      ? "Validating..."
                      : "Preview roster"}
                  </button>
                </div>
              </div>
            ) : null}

            <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <input type="checkbox" checked={currentStudentsOnly} onChange={event => {
                setCurrentStudentsOnly(event.target.checked);
                setPreview(null);
              }} className="mt-0.5" />
              <span><strong>Official current students only.</strong> Tick only if the university has confirmed this roster contains current students. Required when no status column exists. Inactive/withdrawn status values are never overridden. This declaration is saved with the import.</span>
            </label>

            {preview ? (
              <div className="mt-5">
                <div
                  className={`rounded-xl border p-4 ${
                    preview.valid
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <p
                    className={`font-bold ${
                      preview.valid
                        ? "text-emerald-900"
                        : "text-red-900"
                    }`}
                  >
                    {preview.valid
                      ? "Roster passed validation"
                      : "Roster cannot be imported yet"}
                  </p>

                  <p
                    className={`mt-1 text-sm leading-6 ${
                      preview.valid
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {preview.valid
                      ? "Every row passed CampusMart's roster validation."
                      : "Correct the CSV and preview it again before importing."}
                  </p>
                </div>

                {preview.overlap && <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-emerald-50 p-3 text-xs"><strong className="block text-lg text-emerald-900">{preview.overlap.newMatricNumbers}</strong> New matric numbers</div>
                  <div className="rounded-lg bg-slate-100 p-3 text-xs"><strong className="block text-lg">{preview.overlap.alreadyInOtherSources}</strong> Already in active sources</div>
                  <div className="rounded-lg bg-amber-50 p-3 text-xs"><strong className="block text-lg text-amber-900">{preview.overlap.conflicts}</strong> Conflicting records</div>
                </div>}
                <p className="mt-2 text-xs text-slate-500">Overlapping student records remain linked to both sources. Conflicts block automatic approval until investigated.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">
                      CSV rows
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {
                        preview.totalDataRows
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">
                      Accepted
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {
                        preview.acceptedRecordCount
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-700">
                      Active
                    </p>

                    <p className="mt-1 text-xl font-black text-emerald-900">
                      {
                        preview.activeRecordCount
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                      Inactive
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-900">
                      {
                        preview.inactiveRecordCount
                      }
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border p-4 ${
                      preview.rejectedRowCount >
                      0
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="text-xs text-slate-500">
                      Rejected
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {
                        preview.rejectedRowCount
                      }
                    </p>
                  </div>
                </div>

                {preview.fileErrors.length >
                0 ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-bold text-red-900">
                      File problems
                    </p>

                    <div className="mt-3 space-y-2">
                      {preview.fileErrors.map(
                        (
                          fileError,
                          index
                        ) => (
                          <p
                            key={`${fileError.code}-${index}`}
                            className="text-sm leading-6 text-red-700"
                          >
                            {
                              fileError.message
                            }
                          </p>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                {preview.rejectedRows.length >
                0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-red-200">
                    <div className="border-b border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-bold text-red-900">
                        Rejected rows
                      </p>
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                      {preview.rejectedRows.map(
                        (
                          row,
                          index
                        ) => (
                          <div
                            key={`${row.sourceRowNumber}-${row.code}-${index}`}
                            className="border-b border-slate-100 px-4 py-3 last:border-b-0"
                          >
                            <p className="text-sm font-bold text-slate-900">
                              Row{" "}
                              {
                                row.sourceRowNumber
                              }
                              {" · "}
                              {
                                row.code
                              }
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {
                                row.message
                              }
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    {preview.rejectedRowsTruncated ? (
                      <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                        Only the first 100 rejected rows
                        are shown.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {preview?.valid ? (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <p className="text-sm font-bold text-slate-950">
                  Import metadata
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Record who supplied this roster and how
                  long CampusMart should consider it
                  current.
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Academic session

                    <input
                      value={
                        metadata.academicSession
                      }
                      onChange={(
                        event
                      ) =>
                        setMetadata(
                          (
                            current
                          ) => ({
                            ...current,

                            academicSession:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="2026/2027"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Source issuer

                    <input
                      value={
                        metadata.sourceIssuer
                      }
                      onChange={(
                        event
                      ) =>
                        setMetadata(
                          (
                            current
                          ) => ({
                            ...current,

                            sourceIssuer:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="University Registry"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Source reference
                    <span className="ml-1 font-normal text-slate-400">
                      optional
                    </span>

                    <input
                      value={
                        metadata.sourceReference
                      }
                      onChange={(
                        event
                      ) =>
                        setMetadata(
                          (
                            current
                          ) => ({
                            ...current,

                            sourceReference:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Registry export reference, memo number, authorised contact reference..."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Valid from
                    <span className="ml-1 font-normal text-slate-400">
                      optional
                    </span>

                    <input
                      type="date"
                      value={
                        metadata.validFrom
                      }
                      onChange={(
                        event
                      ) =>
                        setMetadata(
                          (
                            current
                          ) => ({
                            ...current,

                            validFrom:
                              event.target.value,
                          })
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Expires
                    <span className="ml-1 font-normal text-slate-400">
                      optional
                    </span>

                    <input
                      type="date"
                      value={
                        metadata.expiresAt
                      }
                      onChange={(
                        event
                      ) =>
                        setMetadata(
                          (
                            current
                          ) => ({
                            ...current,

                            expiresAt:
                              event.target.value,
                          })
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={
                    !canImport ||
                    importing
                  }
                  onClick={() =>
                    void importRoster()
                  }
                  className="mt-5 w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing
                    ? "Importing roster..."
                    : "Import and add roster source"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Audit history
                </p>

                <h3 className="mt-2 text-lg font-bold text-slate-950">
                  Roster sources and history
                </h3>
              </div>

              <span className="text-sm font-semibold text-slate-500">
                {history.length}{" "}
                import
                {history.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            {history.length ===
            0 ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No roster import history yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {history.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-950">
                              {
                                item.academicSession
                              }
                            </p>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(
                                item.status
                              )}`}
                            >
                              {statusLabel(
                                item.status
                              )}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              item.sourceIssuer
                            }
                          </p>

                          <p className="mt-1 break-all text-xs text-slate-400">
                            {
                              item.originalFileName
                            }
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-sm font-bold text-slate-950">
                            {
                              item.recordCount
                            }{" "}
                            records
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Imported{" "}
                            {formatDateTime(
                              item.importedAt
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                          <span className="font-bold">
                            {
                              item.activeRecordCount
                            }
                          </span>{" "}
                          active
                        </div>

                        <div className="rounded-lg bg-slate-100 p-3 text-slate-700">
                          <span className="font-bold">
                            {
                              item.inactiveRecordCount
                            }
                          </span>{" "}
                          inactive
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3 text-slate-600">
                          Expires{" "}
                          <span className="font-bold">
                            {formatDate(
                              item.expiresAt
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.trustedForAutomatedVerification ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">Certified · {item.rosterScope || "institution"}{item.sourceUnit ? ` · ${item.sourceUnit}` : ""}</span>
                          ) : <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Not certified</span>}
                        </div>
                        {item.status === "active" && <div className="flex gap-2">
                          {!item.trustedForAutomatedVerification && <button type="button" onClick={() => {setSourceAction({id:item.id,action:"certify"});setSourceReason("");setSourceConfirmed(false);}}
                            className="rounded-lg border border-slate-300 px-3 py-2 font-semibold">Certify source</button>}
                          <button type="button" onClick={() => {setSourceAction({id:item.id,action:"archive"});setSourceReason("");setSourceConfirmed(false);}}
                            className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-800">Archive</button>
                        </div>}
                      </div>
                      {sourceAction?.id === item.id && <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                        <div className="font-bold">{sourceAction.action === "archive" ? "Archive this source" : "Approve trusted student register"}</div>
                        {sourceAction.action === "certify" && <>
                          <label className="block text-xs font-semibold">Authorised coverage</label>
                          <select value={sourceScope} onChange={e => setSourceScope(e.target.value as typeof sourceScope)} className="w-full rounded-lg border border-slate-300 bg-white p-2">
                            <option value="department">Department</option><option value="faculty">Faculty</option><option value="institution">Whole institution</option>
                          </select>
                          {sourceScope !== "institution" && <input value={sourceUnit} onChange={e => setSourceUnit(e.target.value)} placeholder="Official department or faculty name" className="w-full rounded-lg border border-slate-300 bg-white p-2"/>}
                          <p className="text-xs text-amber-900">Certification requires evidence of an official current-student source. Class attendance alone is not enough.</p>
                        </>}
                        <textarea value={sourceReason} onChange={e => setSourceReason(e.target.value)} rows={2} placeholder="Source authority, evidence, reason (minimum 20 characters)" className="w-full rounded-lg border border-slate-300 bg-white p-2"/>
                        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={sourceConfirmed} onChange={e => setSourceConfirmed(e.target.checked)}/>
                          <span>{sourceAction.action === "archive" ? "I confirm this source should stop contributing to automatic matching." : "I confirm this source is an authorised current student register for the scope selected."}</span>
                        </label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setSourceAction(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Cancel</button>
                          <button type="button" disabled={sourceBusy || !sourceConfirmed || sourceReason.trim().length < 20 || (sourceAction.action === "certify" && sourceScope !== "institution" && sourceUnit.trim().length < 3)} onClick={() => void applySourceAction()} className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-40">{sourceBusy ? "Saving..." : "Review and confirm"}</button>
                        </div>
                      </div>}

                      {item.failureReason ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                          {
                            item.failureReason
                          }
                        </div>
                      ) : null}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}