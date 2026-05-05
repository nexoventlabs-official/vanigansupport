/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wati: {
          primary: '#00a884',
          primaryDark: '#008069',
          bg: '#efeae2',
          sidebar: '#ffffff',
          panel: '#f0f2f5',
          bubbleOut: '#d9fdd3',
          bubbleIn: '#ffffff',
          text: '#111b21',
          muted: '#667781',
          header: '#008069',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        bubble: '0 1px 0.5px rgba(11,20,26,.13)',
      },
    },
  },
  plugins: [],
};
