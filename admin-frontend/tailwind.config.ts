import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        background: '#FFFFFF',
        text: '#1F2937',
        'text-secondary': '#6B7280',
        border: '#E5E7EB',
        success: '#10B981',
        error: '#EF4444',
      },
      borderRadius: {
        'subtle': '8px',
      },
    },
  },
  plugins: [],
};

export default config;
