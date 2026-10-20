"use client";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";


import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import PageShell from "@/components/common/PageShell";

import {
  useAuth,
} from "@/components/common/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const MAX_PICKUP_POINTS =
  10;

type PickupPointType =
  | "campus"
  | "hostel_block"
  | "faculty_building"
  | "custom";

type PickupPoint = {
  id: string;

  type:
    PickupPointType;

  label:
    string;

  detail:
    | string
    | null;

  isLegacy?:
    boolean;
};

type PickupTypeOption = {
  value:
    PickupPointType;

  label:
    string;

  description:
    string;

  placeholder:
    string;
};

const pickupTypes:
  PickupTypeOption[] = [
    {
      value:
        "campus",

      label:
        "Campus",

      description:
        "A general university campus pickup location.",

      placeholder:
        "Main Campus",
    },

    {
      value:
        "hostel_block",

      label:
        "Hostel block",

      description:
        "Meet buyers around a hostel or accommodation block.",

      placeholder:
        "Block C",
    },

    {
      value:
        "faculty_building",

      label:
        "Faculty building",

      description:
        "Use a faculty, department or academic building.",

      placeholder:
        "Science Faculty",
    },

    {
      value:
        "custom",

      label:
        "Other",

      description:
        "Any convenient public campus meeting point.",

      placeholder:
        "Library Gate",
    },
  ];

function pickupTypeLabel(
  type:
    PickupPointType
) {
  return (
    pickupTypes.find(
      (
        option
      ) =>
        option.value ===
        type
    )?.label ||
    "Pickup point"
  );
}

export default function Page() {
  const campusMartConfirm = useCampusMartConfirm();

  const {
    user,
    openAuth,
  } =
    useAuth();

  const [
    pickupPoints,
    setPickupPoints,
  ] =
    useState<
      PickupPoint[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    type,
    setType,
  ] =
    useState<
      PickupPointType
    >(
      "campus"
    );

  const [
    label,
    setLabel,
  ] =
    useState(
      ""
    );

  const [
    detail,
    setDetail,
  ] =
    useState(
      ""
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  /*
   * =====================================================
   * HELPERS
   * =====================================================
   */

  const currentType =
    useMemo(
      () =>
        pickupTypes.find(
          (
            option
          ) =>
            option.value ===
            type
        ) ??
        pickupTypes[0],
      [
        type,
      ]
    );

  const structuredPickupCount =
    pickupPoints.filter(
      (
        point
      ) =>
        !point.isLegacy
    ).length;

  const atLimit =
    structuredPickupCount >=
    MAX_PICKUP_POINTS;

  const resetForm =
    () => {
      setEditingId(
        null
      );

      setType(
        "campus"
      );

      setLabel(
        ""
      );

      setDetail(
        ""
      );

      setError(
        ""
      );
    };

  /*
   * =====================================================
   * LOAD PICKUP POINTS
   * =====================================================
   */

  const loadPickupPoints =
    useCallback(
      async (
        signal?:
          AbortSignal
      ) => {
        if (
          user?.role !==
          "vendor"
        ) {
          setPickupPoints(
            []
          );

          setLoading(
            false
          );

          return;
        }

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          throw new Error(
            "Your session is unavailable. Please sign in again."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/vendor/pickup-points`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              signal,

              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to load pickup points."
          );
        }

        setPickupPoints(
          Array.isArray(
            data.pickupPoints
          )
            ? data.pickupPoints
            : []
        );
      },
      [
        user,
      ]
    );

  useEffect(() => {
    if (
      user?.role !==
      "vendor"
    ) {
      setLoading(
        false
      );

      return;
    }

    const controller =
      new AbortController();

    const run =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          await loadPickupPoints(
            controller.signal
          );
        } catch (
          pickupError
        ) {
          if (
            pickupError instanceof
              DOMException &&
            pickupError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Pickup point load error:",
            pickupError
          );

          setError(
            pickupError instanceof
              Error
              ? pickupError.message
              : "Unable to load pickup points."
          );
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(
              false
            );
          }
        }
      };

    void run();

    return () => {
      controller.abort();
    };
  }, [
    user,
    loadPickupPoints,
  ]);

  /*
   * =====================================================
   * EDIT
   * =====================================================
   */

  const startEditing =
    (
      point:
        PickupPoint
    ) => {
      if (
        point.isLegacy
      ) {
        return;
      }

      setEditingId(
        point.id
      );

      setType(
        point.type
      );

      setLabel(
        point.label
      );

      setDetail(
        point.detail ??
          ""
      );

      setError(
        ""
      );

      window.scrollTo({
        top:
          0,

        behavior:
          "smooth",
      });
    };

  /*
   * =====================================================
   * CREATE / UPDATE
   * =====================================================
   */

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        user?.role !==
          "vendor" ||
        saving
      ) {
        return;
      }

      const cleanLabel =
        label.trim();

      const cleanDetail =
        detail.trim();

      if (
        cleanLabel.length <
        2
      ) {
        setError(
          "Enter a clear name for this pickup point."
        );

        return;
      }

      if (
        cleanLabel.length >
        80
      ) {
        setError(
          "Pickup-point names can be up to 80 characters."
        );

        return;
      }

      if (
        cleanDetail.length >
        160
      ) {
        setError(
          "Pickup instructions can be up to 160 characters."
        );

        return;
      }

      if (
        !editingId &&
        atLimit
      ) {
        setError(
          `You can currently keep up to ${MAX_PICKUP_POINTS} active pickup points.`
        );

        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setError(
          "Your session is unavailable. Please sign in again."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        setError(
          ""
        );

        const editing =
          Boolean(
            editingId
          );

        const response =
          await fetch(
            editing
              ? `${API_URL}/api/vendor/pickup-points/${encodeURIComponent(
                  editingId as string
                )}`
              : `${API_URL}/api/vendor/pickup-points`,
            {
              method:
                editing
                  ? "PATCH"
                  : "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  type,

                  label:
                    cleanLabel,

                  detail:
                    cleanDetail,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              (
                editing
                  ? "Unable to update pickup point."
                  : "Unable to add pickup point."
              )
          );
        }

        resetForm();

        await loadPickupPoints();

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  editing
                    ? "Pickup point updated"
                    : "Pickup point added",
              },
            }
          )
        );
      } catch (
        saveError
      ) {
        console.error(
          "Pickup point save error:",
          saveError
        );

        setError(
          saveError instanceof
            Error
            ? saveError.message
            : "Unable to save pickup point."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /*
   * =====================================================
   * REMOVE
   * =====================================================
   */

  const removePickupPoint =
    async (
      point:
        PickupPoint
    ) => {
      if (
        point.isLegacy ||
        deletingId
      ) {
        return;
      }

      if (
        !await campusMartConfirm({ title: "Confirm action", description: `Remove "${point.label}" from your available pickup points? Existing orders will keep their saved pickup information.`, danger: true })
      ) {
        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setError(
          "Your session is unavailable. Please sign in again."
        );

        return;
      }

      try {
        setDeletingId(
          point.id
        );

        setError(
          ""
        );

        const response =
          await fetch(
            `${API_URL}/api/vendor/pickup-points/${encodeURIComponent(
              point.id
            )}`,
            {
              method:
                "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to remove pickup point."
          );
        }

        if (
          editingId ===
          point.id
        ) {
          resetForm();
        }

        await loadPickupPoints();

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Pickup point removed",
              },
            }
          )
        );
      } catch (
        removeError
      ) {
        console.error(
          "Pickup point removal error:",
          removeError
        );

        setError(
          removeError instanceof
            Error
            ? removeError.message
            : "Unable to remove pickup point."
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  /*
   * =====================================================
   * ACCESS
   * =====================================================
   */

  if (
    !user
  ) {
    return (
      <PageShell
        title="Pickup points"
        description="Choose the campus locations where buyers can collect their orders."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center">
          <h2 className="text-2xl font-black text-slate-950">
            Sign in to continue
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Seller pickup points are linked to your CampusMart account.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-black text-black"
          >
            Sign in
          </button>
        </section>
      </PageShell>
    );
  }

  if (
    user.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Pickup points"
        description="Choose the campus locations where buyers can collect their orders."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center">
          <h2 className="text-2xl font-black text-slate-950">
            Seller access required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Become a seller before creating pickup locations for buyers.
          </p>

          <Link
            href="/sell"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-black text-black"
          >
            Sell on CampusMart
          </Link>
        </section>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <PageShell
      title="Pickup points"
      description="Set the places you are comfortable meeting buyers. They will choose from these options during checkout."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/*
         * ===============================================
         * FORM
         * ===============================================
         */}

        <section className="site-card h-fit p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {
                  editingId
                    ? "Edit location"
                    : "Add location"
                }
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                {
                  editingId
                    ? "Update pickup point"
                    : "Where can buyers meet you?"
                }
              </h2>
            </div>

            {editingId ? (
              <button
                type="button"
                onClick={
                  resetForm
                }
                disabled={
                  saving
                }
                className="text-xs font-bold text-slate-500 hover:text-black"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-6"
          >
            <fieldset
              disabled={
                saving
              }
            >
              <legend className="text-sm font-black text-slate-900">
                Location type
              </legend>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {pickupTypes.map(
                  (
                    option
                  ) => {
                    const selected =
                      type ===
                      option.value;

                    return (
                      <button
                        key={
                          option.value
                        }
                        type="button"
                        onClick={() => {
                          setType(
                            option.value
                          );

                          setError(
                            ""
                          );
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          selected
                            ? "border-[#4A1724] bg-[#FBF6ED]"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="block text-sm font-black text-slate-900">
                          {
                            option.label
                          }
                        </span>

                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                          {
                            option.description
                          }
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              <label className="mt-5 block text-sm font-bold text-slate-800">
                {
                  currentType.label
                }{" "}
                name

                <input
                  type="text"
                  required
                  maxLength={
                    80
                  }
                  value={
                    label
                  }
                  onChange={(
                    event
                  ) => {
                    setLabel(
                      event.target.value
                    );

                    setError(
                      ""
                    );
                  }}
                  placeholder={
                    currentType.placeholder
                  }
                  className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#4A1724] focus:bg-white"
                />
              </label>

              <label className="mt-5 block text-sm font-bold text-slate-800">
                Extra directions{" "}

                <span className="font-normal text-slate-400">
                  — optional
                </span>

                <textarea
                  rows={
                    3
                  }
                  maxLength={
                    160
                  }
                  value={
                    detail
                  }
                  onChange={(
                    event
                  ) => {
                    setDetail(
                      event.target.value
                    );

                    setError(
                      ""
                    );
                  }}
                  placeholder="e.g. Beside the faculty notice board"
                  className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-[#4A1724] focus:bg-white"
                />
              </label>
            </fieldset>

            <div className="mt-2 text-right text-[11px] text-slate-400">
              {
                detail.length
              }
              /160
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700"
              >
                {
                  error
                }
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                saving ||
                (
                  !editingId &&
                  atLimit
                )
              }
              className="mt-5 w-full rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-black text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add pickup point"}
            </button>

            {!editingId &&
            atLimit ? (
              <p className="mt-3 text-center text-xs font-semibold text-amber-700">
                You have reached the current limit of{" "}
                {
                  MAX_PICKUP_POINTS
                }{" "}
                active pickup points.
              </p>
            ) : null}
          </form>
        </section>

        {/*
         * ===============================================
         * CURRENT LOCATIONS
         * ===============================================
         */}

        <section className="space-y-4">
          <div className="site-card p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Buyer options
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Available pickup points
                </h2>

                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                  Buyers choose one of these locations for your part of their order.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                {
                  structuredPickupCount
                }
                /
                {
                  MAX_PICKUP_POINTS
                }
              </span>
            </div>

            {loading ? (
              <div className="mt-5 space-y-3">
                {[
                  1,
                  2,
                  3,
                ].map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item
                      }
                      className="h-24 animate-pulse rounded-xl bg-slate-100"
                    />
                  )
                )}
              </div>
            ) : pickupPoints.length ===
              0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="font-black text-slate-900">
                  No pickup points yet
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Add at least one place where buyers can conveniently meet you.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {pickupPoints.map(
                  (
                    point
                  ) => (
                    <article
                      key={
                        point.id
                      }
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#F0E2D6] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#6F2232]">
                              {pickupTypeLabel(
                                point.type
                              )}
                            </span>

                            {point.isLegacy ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
                                Current default
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-3 text-base font-black text-slate-950">
                            {
                              point.label
                            }
                          </h3>

                          {point.detail ? (
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {
                                point.detail
                              }
                            </p>
                          ) : null}

                          {point.isLegacy ? (
                            <p className="mt-3 text-xs leading-5 text-amber-700">
                              This is your old seller pickup location. Add a new structured pickup point to start using the new checkout system.
                            </p>
                          ) : null}
                        </div>

                        {!point.isLegacy ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              disabled={
                                deletingId ===
                                point.id
                              }
                              onClick={() =>
                                startEditing(
                                  point
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:text-black disabled:opacity-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={
                                deletingId ===
                                point.id
                              }
                              onClick={() =>
                                void removePickupPoint(
                                  point
                                )
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId ===
                              point.id
                                ? "Removing..."
                                : "Remove"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </div>

          {/*
           * ===============================================
           * DELIVERY
           * ===============================================
           */}

          <div className="site-card p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
                🚚
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black text-slate-950">
                    Door delivery
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Coming soon
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Door delivery is not available yet. When CampusMart logistics goes live, buyers will be able to choose recognised hostel blocks and delivery destinations with the appropriate delivery fee.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-black text-blue-950">
              Existing orders stay safe
            </p>

            <p className="mt-1 text-xs leading-5 text-blue-800">
              CampusMart saves a snapshot of the pickup point selected at checkout. Editing or removing a pickup point later will not change the location recorded on an existing order.
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}