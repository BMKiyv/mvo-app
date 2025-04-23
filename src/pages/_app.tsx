// pages/_app.tsx
import * as React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider, createTheme, CssBaseline, PaletteMode } from '@mui/material';
import Layout from '../components/Layout'; // Import the Layout component

// --- Theme Context (for switching themes) ---
interface ThemeContextType {
  toggleColorMode: () => void;
  mode: PaletteMode;
}

// Create context with a default value (can be undefined initially)
export const ColorModeContext = React.createContext<ThemeContextType | undefined>(undefined);

// --- Main App Component ---
export default function MyApp({ Component, pageProps }: AppProps) {
  const [mode, setMode] = React.useState<PaletteMode>('light'); // Default to light mode

  // Memoize the color mode context value
  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
      mode, // Provide current mode
    }),
    [mode],
  );

  // Memoize the theme creation based on the mode
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode, // Use the state variable for the mode
          // You can customize palettes further here if needed
           primary: { main: '#1b1956' },
           secondary: { main: '#3b186b' },
        },
        typography: {
          // Define global typography settings if needed
          // fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        },
        // You can customize other theme aspects like components defaults, spacing, etc.
      }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <Head>
          <title>Облік Матеріальних Цінностей</title>
          <meta name="viewport" content="initial-scale=1, width=device-width" />
          {/* Add other meta tags or link tags here */}
        </Head>
        {/* Wrap the Component with the Layout */}
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
