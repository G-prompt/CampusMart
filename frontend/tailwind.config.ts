import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {50: "#F7F7F7",100: "#EDEDED",200: "#D6D6D6",300: "#B0B0B0",400: "#8A8A8A",500: "#5C5C5C",600: "#3D3D3D",700: "#242424",800: "#151515",900: "#0A0A0A"},
        accent: {50: "#FFF3E8",100: "#FFE1C7",200: "#FFC08A",300: "#FF9A4D",400: "#FF6B00",500: "#F45B00",600: "#D94D00",700: "#B84000",800: "#913400",900: "#702A00"}
      },
      boxShadow: {soft: "0 20px 45px rgba(15, 23, 42, 0.08)", card: "0 18px 40px rgba(15, 23, 42, 0.06)"},
      backgroundImage: {"brand-gradient": "linear-gradient(90deg, #0A0A0A 0%, #FF6B00 100%)"}
    }
  },
  plugins: [],
};

export default config;
