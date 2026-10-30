module.exports = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dream: {
              50: '#f0e7ff', 100: '#d9c5ff', 200: '#b68aff', 300: '#9455ff',
              400: '#7c3aed', 500: '#6d28d9', 600: '#5b21b6', 700: '#4c1d95',
              800: '#3b0f7a', 900: '#2e0a5e', 950: '#1a0536'
            },
            night: {
              50: '#e8eaf6', 100: '#c5cae9', 200: '#9fa8da', 300: '#7986cb',
              400: '#5c6bc0', 500: '#3f51b5', 600: '#303f9f', 700: '#283593',
              800: '#1a237e', 900: '#0f1547', 950: '#0a0d2e'
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            display: ['Outfit', 'Inter', 'sans-serif']
          }
        }
      }
    ,
  content: ['./src/**/*.{ts,tsx}', './public/static/app.js']
};
