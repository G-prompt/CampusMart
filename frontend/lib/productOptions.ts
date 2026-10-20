export const CLOTHING_SIZES = [
  {
    value:
      "S",

    guide:
      "86–91 cm chest",
  },

  {
    value:
      "M",

    guide:
      "97–102 cm chest",
  },

  {
    value:
      "L",

    guide:
      "107–112 cm chest",
  },

  {
    value:
      "XL",

    guide:
      "117–122 cm chest",
  },

  {
    value:
      "XXL",

    guide:
      "127–132 cm chest",
  },

  {
    value:
      "XXXL",

    guide:
      "137–142 cm chest",
  },
];

export const SHOE_SIZES =
  Array.from(
    {
      length:
        10,
    },
    (
      _,
      index
    ) => ({
      value:
        `EU ${37 + index}`,
    })
  );

export const COMMON_COLOURS = [
  {
    name:
      "Black",
    swatch:
      "#111111",
  },

  {
    name:
      "White",
    swatch:
      "#FFFFFF",
  },

  {
    name:
      "Grey",
    swatch:
      "#9CA3AF",
  },

  {
    name:
      "Brown",
    swatch:
      "#7C4A2D",
  },

  {
    name:
      "Red",
    swatch:
      "#DC2626",
  },

  {
    name:
      "Orange",
    swatch:
      "#EA580C",
  },

  {
    name:
      "Yellow",
    swatch:
      "#FACC15",
  },

  {
    name:
      "Green",
    swatch:
      "#16A34A",
  },

  {
    name:
      "Blue",
    swatch:
      "#2563EB",
  },

  {
    name:
      "Navy",
    swatch:
      "#172554",
  },

  {
    name:
      "Purple",
    swatch:
      "#7E22CE",
  },

  {
    name:
      "Pink",
    swatch:
      "#EC4899",
  },
];

export function getSizeGuide(
  size:
    string
) {
  return CLOTHING_SIZES.find(
    (
      option
    ) =>
      option.value ===
      size
  )?.guide;
}

export function getColourSwatch(
  colour:
    string
) {
  return COMMON_COLOURS.find(
    (
      option
    ) =>
      option.name.toLowerCase() ===
      colour.toLowerCase()
  )?.swatch;
}

export function parseCustomColours(
  value:
    string
) {
  const seen =
    new Set<string>();

  const output:
    string[] =
    [];

  for (
    const raw of
    value.split(
      ","
    )
  ) {
    const colour =
      raw.trim();

    if (
      !colour ||
      colour.length >
        30
    ) {
      continue;
    }

    const key =
      colour.toLowerCase();

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    output.push(
      colour
    );
  }

  return output;
}