import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import IPUploader from './components/IPUploader';
import IPTable from './components/IPTable';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4',
    },
    secondary: {
      main: '#ff4081',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
  },
});

function App() {
  const [ipData, setIpData] = useState([]);
  const [page, setPage] = useState(0);

  const handleIPsSubmit = async (input, type) => {
    try {
      const API_BASE = process.env.NODE_ENV === 'production' 
        ? 'https://ipsleuth.io/api' 
        : 'http://localhost:3001';
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input, type }),
      });
      const data = await response.json();
      setIpData(data);
      setPage(0);
    } catch (error) {
      console.error('Error analyzing IPs:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h1" gutterBottom>
            IPSleuth
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            Analyze IP addresses from PCAP files or text input - No data stored, 100% private
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={9}>
              <IPUploader onIPsSubmit={handleIPsSubmit} />
              {ipData.length > 0 && (
                <IPTable
                  data={ipData}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                />
              )}
            </Grid>
          </Grid>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;