/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/ui/react/**/*.{js,ts,jsx,tsx}",
    "./src/ui/views/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VS Code theme integration
        'vscode': {
          'foreground': 'var(--vscode-foreground)',
          'background': 'var(--vscode-editor-background)', 
          'secondary': 'var(--vscode-descriptionForeground)',
          'border': 'var(--vscode-panel-border)',
          'button': 'var(--vscode-button-background)',
          'button-hover': 'var(--vscode-button-hoverBackground)',
          'button-secondary': 'var(--vscode-button-secondaryBackground)',
          'success': 'var(--vscode-charts-green)',
          'error': 'var(--vscode-charts-red)',
          'warning': 'var(--vscode-charts-yellow)',
          'info': 'var(--vscode-charts-blue)',
        }
      },
      fontFamily: {
        'vscode': 'var(--vscode-font-family)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}