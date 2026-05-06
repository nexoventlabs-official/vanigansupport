/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wati: {
          primary: '#00a884', // Classic WhatsApp Accent
          primaryDark: '#008069', // Classic WhatsApp Teal
          bg: '#e5ddd5', // WhatsApp Chat background
          sidebar: '#ffffff',
          panel: '#f0f2f5', // WhatsApp Panel Header
          bubbleOut: '#dcf8c6', // WhatsApp Sent Bubble
          bubbleIn: '#ffffff', // WhatsApp Received Bubble
          text: '#111b21',
          muted: '#54656f',
          header: '#f0f2f5',
          border: '#d1d7db',
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
