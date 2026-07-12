import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {50: "#F6F8FA",100: "#E8EDF2",200: "#C8D4E0",300: "#9EB1C5",400: "#728CA9",500: "#4F6F8F",600: "#365878",700: "#29486B",800: "#1E3A5F",900: "#152C48"},
        accent: {50: "#F0FDFA",100: "#CCFBF1",200: "#99F6E4",300: "#5EEAD4",400: "#2DD4BF",500: "#14B8A6",600: "#0D9488",700: "#0F766E",800: "#115E59",900: "#134E4A"}
      },
      boxShadow: {soft: "0 20px 45px rgba(15, 23, 42, 0.08)", card: "0 18px 40px rgba(15, 23, 42, 0.06)"},
      backgroundImage: {"brand-gradient": "linear-gradient(90deg, #1E3A5F 0%, #0D9488 100%)"}
    }
  },
  plugins: [],
};

export default config;
