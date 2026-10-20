"use client";

import {
  CLOTHING_SIZES,
  SHOE_SIZES,
} from "@/lib/productOptions";

type ProductSizePickerProps = {
  enabled: boolean;

  selected:
    string[];

  onEnabledChange: (
    enabled:
      boolean
  ) => void;

  onSelectedChange: (
    sizes:
      string[]
  ) => void;
};

type SizeOption = {
  value: string;

  guide?:
    string;
};

type SizeGroup = {
  id:
    "clothing" |
    "shoes";

  label:
    string;

  description:
    string;

  options:
    SizeOption[];
};

const SIZE_GROUPS:
  SizeGroup[] = [
    {
      id:
        "clothing",

      label:
        "Clothing",

      description:
        "Select every clothing size currently available.",

      options:
        CLOTHING_SIZES,
    },

    {
      id:
        "shoes",

      label:
        "Shoes",

      description:
        "Select the available EU shoe sizes.",

      options:
        SHOE_SIZES,
    },
  ];

export default function ProductSizePicker({
  enabled,
  selected,
  onEnabledChange,
  onSelectedChange,
}: ProductSizePickerProps) {
  const toggleSize =
    (
      value:
        string
    ) => {
      const alreadySelected =
        selected.includes(
          value
        );

      if (
        alreadySelected
      ) {
        onSelectedChange(
          selected.filter(
            (
              item
            ) =>
              item !==
              value
          )
        );

        return;
      }

      onSelectedChange([
        ...selected,
        value,
      ]);
    };

  const setEnabled =
    (
      nextEnabled:
        boolean
    ) => {
      onEnabledChange(
        nextEnabled
      );

      if (
        !nextEnabled
      ) {
        onSelectedChange(
          []
        );
      }
    };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={
            enabled
          }
          onChange={(
            event
          ) =>
            setEnabled(
              event.target.checked
            )
          }
          className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#4A1724]"
        />

        <span className="min-w-0">
          <span className="block text-sm font-black text-slate-950">
            Size
          </span>

          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            Optional. Turn this on when buyers need to choose a size before adding the item to cart.
          </span>
        </span>

        <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          Optional
        </span>
      </label>

      {enabled ? (
        <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
          {SIZE_GROUPS.map(
            (
              group
            ) => (
              <div
                key={
                  group.id
                }
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-[#6E3847]">
                    {
                      group.label
                    }
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {
                      group.description
                    }
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {group.options.map(
                    (
                      option
                    ) => {
                      const active =
                        selected.includes(
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
                          aria-pressed={
                            active
                          }
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-[#4A1724] bg-[#4A1724] text-white shadow-sm"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#8A6670] hover:bg-white"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-black ${
                                active
                                  ? "border-white/50 bg-white text-[#4A1724]"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </span>

                            <span className="text-xs font-black">
                              {
                                option.value
                              }
                            </span>
                          </span>

                          {option.guide ? (
                            <span
                              className={`mt-1 block pl-6 text-[9px] font-semibold ${
                                active
                                  ? "text-white/75"
                                  : "text-slate-400"
                              }`}
                            >
                              {
                                option.guide
                              }
                            </span>
                          ) : null}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}

          {selected.length >
          0 ? (
            <div className="rounded-xl bg-[#FBF6ED] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8A6670]">
                Selected
              </p>

              <p className="mt-1 text-xs font-bold leading-5 text-[#4A1724]">
                {
                  selected.join(
                    ", "
                  )
                }
              </p>
            </div>
          ) : (
            <p className="text-xs font-semibold text-amber-700">
              Size is enabled, but no sizes have been selected yet.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}