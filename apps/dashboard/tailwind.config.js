/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1419",
          card: "#1a2332",
          border: "#2d3748",
        },
      },
    },
  },
  plugins: [],
};
