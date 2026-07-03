/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          950: "#05130d",
          900: "#082117",
          800: "#103822",
          700: "#145232",
          500: "#29a36a",
          400: "#61d394"
        }
      },
      fontFamily: {
        display: ["Inter", "Tahoma", "Arial", "sans-serif"],
        arabic: ["Tahoma", "Arial", "sans-serif"]
      },
      boxShadow: {
        glow: "0 20px 80px rgba(41, 163, 106, 0.25)"
      }
    }
  },
  plugins: []
};
