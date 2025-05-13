import * as React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider, createTheme, CssBaseline, PaletteMode, responsiveFontSizes } from '@mui/material';
import { red, blue, pink, grey } from '@mui/material/colors'; // <-- Імпортуємо кольори
import Layout from '../components/Layout'; // Import the Layout component

// --- Theme Context (без змін) ---
interface ThemeContextType {
    toggleColorMode: () => void;
    mode: PaletteMode;
}
export const ColorModeContext = React.createContext<ThemeContextType | undefined>(undefined);

// --- Main App Component ---
export default function MyApp({ Component, pageProps }: AppProps) {
    const [mode, setMode] = React.useState<PaletteMode>('light'); // Починаємо зі світлої

    const colorMode = React.useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
            },
            mode,
        }),
        [mode],
    );

    // --- ВИПРАВЛЕНО: Створення теми з урахуванням режиму ---
    const theme = React.useMemo(() => {
        // Базові налаштування палітри
        const basePalette = {
            mode, // Встановлюємо поточний режим
            // Визначаємо кольори для світлого режиму (або загальні, якщо вони однакові)
            primary: {
                main: blue[700], // Ваш основний синій для світлої (і як база)
            },
            secondary: {
                 main: pink[600], // Ваш вторинний рожевий для світлої (і як база)
            },
            error: {
                main: red.A400, // Червоний для помилок у світлій
            },
            background: {
                // За замовчуванням MUI сам визначить фон для light/dark,
                // але ми можемо перевизначити, якщо потрібно
            },
        };

        // Створюємо тему, додаючи специфічні налаштування для темного режиму
        let createdTheme = createTheme({
            palette: {
                ...basePalette, // Беремо базові налаштування
                ...(mode === 'dark' && { // Якщо режим темний, додаємо/перевизначаємо ці значення
                    primary: {
                        main: blue[400], // Яскравіший синій для темної
                    },
                    secondary: {
                        main: pink[300], // Яскравіший рожевий для темної
                    },
                    error: {
                        main: red[500], // Трохи світліший червоний
                    },
                    background: {
                        default: grey[900], // Темний фон
                        paper: grey[800],   // Колір "паперу"
                    },
                    text: {
                        primary: '#ffffff', // Білий текст
                        secondary: grey[400], // Світло-сірий текст
                    },
                }),
            },
            typography: {
                // Ваші налаштування типографіки...
            },
            components: {
                 // Ваші налаштування компонентів...
            },
        });

        // Робимо шрифти адаптивними (опціонально)
        createdTheme = responsiveFontSizes(createdTheme);
        return createdTheme;

    }, [mode]); // Перестворюємо тему лише при зміні режиму

    // Помилка на рядку 87 (тепер ~98) `<Component {...pageProps} />`
    // зазвичай не пов'язана з темою. Переконайтесь, що Layout
    // правильно приймає та рендерить children.
    // Якщо помилка "Expected 2 arguments, but got 3" залишається,
    // проблема може бути глибше в структурі Layout або Component.

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Head>
                    <title>Облік Матеріальних Цінностей</title>
                    <meta name="viewport" content="initial-scale=1, width=device-width" />
                </Head>
                <Layout>
                    {/* Перевірте, чи Layout не очікує якихось специфічних props */}
                    <Component {...pageProps} />
                </Layout>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}
