// components/Layout.tsx
import * as React from 'react';
import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import ArchiveIcon from '@mui/icons-material/Archive';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AccountCircle from '@mui/icons-material/AccountCircle';
import Link from 'next/link';
import { useRouter } from 'next/router'; // <-- Імпорт useRouter
import Skeleton from '@mui/material/Skeleton';
import fetcher from '@/utils/fetcher'; // Переконайтесь, що шлях правильний
import useSWR from 'swr';
import { ColorModeContext } from '../pages/_app'; // Перевірте шлях

// --- Тип для відповідальної особи ---
type ResponsibleEmployeeData = {
    id: number;
    full_name: string;
} | null;


const drawerWidth = 240;

// --- Styled Components (без змін) ---

const openedMixin = (theme: Theme): CSSObject => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    width: `calc(${theme.spacing(7)} + 1px)`,
    [theme.breakpoints.up('sm')]: {
        width: `calc(${theme.spacing(8)} + 1px)`,
    },
});

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
    ({ theme, open }) => ({
        width: drawerWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...(open && {
            ...openedMixin(theme),
            '& .MuiDrawer-paper': openedMixin(theme),
        }),
        ...(!open && {
            ...closedMixin(theme),
            '& .MuiDrawer-paper': closedMixin(theme),
        }),
    }),
);

// --- Navigation Items (без змін) ---
const navItems = [
    { text: 'Дашборд', icon: <DashboardIcon />, href: '/' },
    { text: 'Співробітники', icon: <PeopleIcon />, href: '/employees' },
    { text: 'Інвентар', icon: <InventoryIcon />, href: '/inventory' },
    { text: 'Архів', icon: <ArchiveIcon />, href: '/archive' },
];

// --- Layout Component ---
interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const theme = useTheme();
    const colorModeContext = React.useContext(ColorModeContext);
    const [open, setOpen] = React.useState(false);
    const router = useRouter(); // <-- Викликаємо useRouter тут, один раз

    const { data: responsiblePerson, error: responsiblePersonError, isLoading: isLoadingResponsible } = useSWR<ResponsibleEmployeeData>(
        '/api/employees/responsible',
        fetcher,
        { revalidateOnFocus: false }
    );

    if (!colorModeContext) {
        return null; // Або індикатор завантаження
    }
    const { toggleColorMode } = colorModeContext;


    const handleDrawerOpen = () => { setOpen(true); };
    const handleDrawerClose = () => { setOpen(false); };

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            {/* --- Top Application Bar (без змін) --- */}
            <AppBar position="fixed" open={open}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{ marginRight: 5, ...(open && { display: 'none' }) }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        Облік Активів
                    </Typography>
                    <IconButton sx={{ ml: 1 }} onClick={toggleColorMode} color="inherit">
                        {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                      <AccountCircle sx={{ mr: 1 }} />
                      {isLoadingResponsible ? (
                          <Skeleton variant="text" width={100} />
                      ) : responsiblePersonError ? (
                          <Typography variant="body1" noWrap color="error" title="Помилка завантаження">
                              Помилка
                          </Typography>
                      ) : responsiblePerson ? (
                          <Typography variant="body1" noWrap>
                              {responsiblePerson.full_name}
                          </Typography>
                      ) : (
                           <Typography variant="body1" noWrap sx={{ fontStyle: 'italic' }}>
                              (не призначено)
                          </Typography>
                      )}
                    </Box>
                </Toolbar>
            </AppBar>

            {/* --- Side Navigation Drawer --- */}
            <Drawer variant="permanent" open={open}>
                <DrawerHeader>
                    <IconButton onClick={handleDrawerClose}>
                        {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                </DrawerHeader>
                <Divider />
                <List>
                    {navItems.map((item) => {
                        // !!! ВИПРАВЛЕНО: Визначення isActive всередині .map !!!
                        const isActive = router.pathname === item.href;

                        return (
                            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                                <Link href={item.href} passHref legacyBehavior>
                                    <ListItemButton
                                        component="a"
                                        selected={isActive} // Використовуємо isActive
                                        sx={{
                                            minHeight: 48,
                                            justifyContent: open ? 'initial' : 'center',
                                            px: 2.5,
                                            color: 'inherit',
                                            textDecoration: 'none',
                                            ...(isActive && {
                                                // Можна додати стилі сюди, якщо selected недостатньо
                                                // backgroundColor: 'action.selected',
                                            }),
                                            '&:hover': {
                                                backgroundColor: 'action.hover',
                                            },
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: 0,
                                                mr: open ? 3 : 'auto',
                                                justifyContent: 'center',
                                                color: isActive ? 'primary.main' : 'inherit', // Використовуємо isActive
                                            }}
                                        >
                                            {item.icon}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.text}
                                            sx={{ opacity: open ? 1 : 0 }}
                                            primaryTypographyProps={{
                                                fontWeight: isActive ? 'bold' : 'regular', // Використовуємо isActive
                                            }}
                                        />
                                    </ListItemButton>
                                </Link>
                            </ListItem>
                        );
                    })}
                </List>
                {/* --- Інші секції Drawer (якщо є) --- */}
            </Drawer>

            {/* --- Main Content Area (без змін) --- */}
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                <DrawerHeader />
                {children}
            </Box>
        </Box>
    );
}
