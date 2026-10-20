"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CLOTHING_SIZES,
  COMMON_COLOURS,
  SHOE_SIZES,
  parseCustomColours,
} from "@/lib/productOptions";

type Props = {
  sizes:
    string[];

  colors:
    string[];

  onSizesChange: (
    sizes:
      string[]
  ) => void;

  onColorsChange: (
    colors:
      string[]
  ) => void;
};

const MAX_CUSTOM_COLOURS =
  6;

export default function ProductOptionsEditor({
  sizes,
  colors,
  onSizesChange,
  onColorsChange,
}: Props) {
  const [
    sizesEnabled,
    setSizesEnabled,
  ] =
    useState(
      sizes.length >
        0
    );

  const [
    coloursEnabled,
    setColoursEnabled,
  ] =
    useState(
      colors.length >
        0
    );

  const standardColourNames =
    useMemo(
      () =>
        new Set(
          COMMON_COLOURS.map(
            (
              colour
            ) =>
              colour.name.toLowerCase()
          )
        ),
      []
    );

  const customColours =
    useMemo(
      () =>
        colors.filter(
          (
            colour
          ) =>
            !standardColourNames.has(
              colour.toLowerCase()
            )
        ),
      [
        colors,
        standardColourNames,
      ]
    );

  const [
    otherColoursOpen,
    setOtherColoursOpen,
  ] =
    useState(
      customColours.length >
        0
    );

  const [
    otherColoursText,
    setOtherColoursText,
  ] =
    useState(
      customColours.join(
        ", "
      )
    );

  useEffect(() => {
    if (
      sizes.length >
      0
    ) {
      setSizesEnabled(
        true
      );
    }
  }, [
    sizes,
  ]);

  useEffect(() => {
    if (
      colors.length >
      0
    ) {
      setColoursEnabled(
        true
      );
    }

    if (
      customColours.length >
      0
    ) {
      setOtherColoursOpen(
        true
      );
    }

    setOtherColoursText(
      customColours.join(
        ", "
      )
    );
  }, [
    customColours.join(
      "|"
    ),
  ]);

  const toggleSize =
    (
      size:
        string
    ) => {
      if (
        sizes.includes(
          size
        )
      ) {
        onSizesChange(
          sizes.filter(
            (
              value
            ) =>
              value !==
              size
          )
        );

        return;
      }

      onSizesChange([
        ...sizes,
        size,
      ]);
    };

  const setSizeAvailability =
    (
      enabled:
        boolean
    ) => {
      setSizesEnabled(
        enabled
      );

      if (
        !enabled
      ) {
        onSizesChange(
          []
        );
      }
    };

  const selectedPresetColours =
    colors.filter(
      (
        colour
      ) =>
        standardColourNames.has(
          colour.toLowerCase()
        )
    );

  const applyCustomColours =
    (
      value:
        string
    ) => {
      setOtherColoursText(
        value
      );

      const parsed =
        parseCustomColours(
          value
        ).slice(
          0,
          MAX_CUSTOM_COLOURS
        );

      onColorsChange([
        ...selectedPresetColours,
        ...parsed,
      ]);
    };

  const togglePresetColour =
    (
      colour:
        string
    ) => {
      const selected =
        colors.some(
          (
            item
          ) =>
            item.toLowerCase() ===
            colour.toLowerCase()
        );

      const nextPresets =
        selected
          ? selectedPresetColours.filter(
              (
                item
              ) =>
                item.toLowerCase() !==
                colour.toLowerCase()
            )
          : [
              ...selectedPresetColours,
              colour,
            ];

      onColorsChange([
        ...nextPresets,
        ...customColours,
      ]);
    };

  const setColourAvailability =
    (
      enabled:
        boolean
    ) => {
      setColoursEnabled(
        enabled
      );

      if (
        !enabled
      ) {
        setOtherColoursOpen(
          false
        );

        setOtherColoursText(
          ""
        );

        onColorsChange(
          []
        );
      }
    };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={
              sizesEnabled
            }
            onChange={(
              event
            ) =>
              setSizeAvailability(
                event.target.checked
              )
            }
            className="mt-1 h-4 w-4 accent-[#4A1724]"
          />

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-slate-950">
              Does this item have sizes?
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Buyers will have to choose one of the available sizes before adding the item to cart.
            </span>
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
            Optional
          </span>
        </label>

        {sizesEnabled ? (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A6670]">
                Clothing
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {CLOTHING_SIZES.map(
                  (
                    option
                  ) => {
                    const selected =
                      sizes.includes(
                        option.value
                      );

                    return (
                      <button
                        key={
                          option.value
                        }
                        type="button"
                        onClick={() =>
                          toggleSize(
                            option.value
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                          selected
                            ? "border-[#4A1724] bg-[#4A1724] text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#4A1724] hover:bg-white"
                        }`}
                      >
                        {
                          option.value
                        }
                      </button>
                    );
                  }
                )}
              </div>

              <p className="mt-2 text-[10px] leading-5 text-slate-400">
                Buyers can open the size guide on the product page if they want the measurements.
              </p>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A6670]">
                Shoes
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {SHOE_SIZES.map(
                  (
                    option
                  ) => {
                    const selected =
                      sizes.includes(
                        option.value
                      );

                    return (
                      <button
                        key={
                          option.value
                        }
                        type="button"
                        onClick={() =>
                          toggleSize(
                            option.value
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                          selected
                            ? "border-[#4A1724] bg-[#4A1724] text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#4A1724] hover:bg-white"
                        }`}
                      >
                        {
                          option.value
                        }
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {sizes.length >
            0 ? (
              <div className="mt-5 rounded-xl bg-[#FBF6ED] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8A6670]">
                  Available sizes
                </p>

                <p className="mt-1 text-xs font-bold leading-5 text-[#4A1724]">
                  {sizes.join(
                    ", "
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs font-bold text-amber-700">
                Select at least one size, or turn sizing off.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={
              coloursEnabled
            }
            onChange={(
              event
            ) =>
              setColourAvailability(
                event.target.checked
              )
            }
            className="mt-1 h-4 w-4 accent-[#4A1724]"
          />

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-slate-950">
              Available colours
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Select every colour buyers can currently choose for this listing.
            </span>
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
            Optional
          </span>
        </label>

        {coloursEnabled ? (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="grid grid-cols-3 gap-2 min-[460px]:grid-cols-4 sm:grid-cols-6">
              {COMMON_COLOURS.map(
                (
                  colour
                ) => {
                  const selected =
                    colors.some(
                      (
                        item
                      ) =>
                        item.toLowerCase() ===
                        colour.name.toLowerCase()
                    );

                  return (
                    <button
                      key={
                        colour.name
                      }
                      type="button"
                      onClick={() =>
                        togglePresetColour(
                          colour.name
                        )
                      }
                      aria-pressed={
                        selected
                      }
                      className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left text-[10px] font-black transition ${
                        selected
                          ? "border-[#4A1724] bg-[#FBF6ED] text-[#4A1724] ring-1 ring-[#4A1724]"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#8A6670] hover:bg-white"
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-black/15"
                        style={{
                          backgroundColor:
                            colour.swatch,
                        }}
                      />

                      <span className="truncate">
                        {
                          colour.name
                        }
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setOtherColoursOpen(
                  (
                    open
                  ) =>
                    !open
                )
              }
              className={`mt-3 rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                otherColoursOpen
                  ? "border-[#4A1724] bg-[#4A1724] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#4A1724]"
              }`}
            >
              {otherColoursOpen
                ? "Hide other colours"
                : "+ Other colours"}
            </button>

            {otherColoursOpen ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-4">
                <label className="block text-xs font-black text-slate-800">
                  Other available colours

                  <input
                    type="text"
                    value={
                      otherColoursText
                    }
                    onChange={(
                      event
                    ) =>
                      applyCustomColours(
                        event.target.value
                      )
                    }
                    placeholder="Cream, Burgundy, Mint green"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#4A1724]"
                  />
                </label>

                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  Separate colours with commas. You can add up to {MAX_CUSTOM_COLOURS} custom colours.
                </p>
              </div>
            ) : null}

            {colors.length >
            0 ? (
              <div className="mt-4 rounded-xl bg-[#FBF6ED] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8A6670]">
                  Available colours
                </p>

                <p className="mt-1 text-xs font-bold leading-5 text-[#4A1724]">
                  {colors.join(
                    ", "
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs font-bold text-amber-700">
                Select at least one colour, or turn colour options off.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}