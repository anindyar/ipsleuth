import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

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
});

function App() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze IP');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container>
        <Box sx={{ my: 4 }}>
          <Typography variant="h1" component="h1" gutterBottom>
            IPSleuth
          </Typography>
          
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Enter IP Address"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  variant="outlined"
                  placeholder="e.g., 8.8.8.8"
                />
              </Grid>
              <Grid item xs={12}>
                <Button 
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                >
                  {loading ? 'Analyzing...' : 'ANALYZE'}
                </Button>
              </Grid>
            </Grid>
          </form>

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              Error: {error}
            </Typography>
          )}

          {results.length > 0 && (
            <Box sx={{ mt: 4 }}>
              {results.map((result, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    IP: {result.ip}
                  </Typography>
                  <Typography>
                    Location: {result.city}, {result.country} ({result.continent})
                  </Typography>
                  <Typography>
                    Organization: {result.organization}
                  </Typography>
                  {result.reputation && (
                    <>
                      <Typography>
                        Threat Level: {result.reputation.threatLevel}
                      </Typography>
                      <Typography>
                        Tags: {result.reputation.tags.join(', ') || 'None'}
                      </Typography>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;