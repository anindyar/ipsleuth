import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';

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
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Clean up input - remove empty lines and extra whitespace
      const cleanInput = input
        .split(/[\n,\s]+/)
        .filter(ip => ip.trim())
        .join('\n');
      
      const ips = cleanInput.split(/[\n,\s]+/).filter(ip => ip.trim());
      if (ips.length > 50) {
        setProgress(0);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: cleanInput }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze IP');
      }

      const data = await response.json();
      setProgress(100);
      setResults(data);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        // Extract and clean IPs
        const ips = text
          .match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)
          ?.filter(ip => ip.trim()) || [];
        setInput(ips.join('\n'));
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDownloadClose = () => {
    setAnchorEl(null);
  };

  const downloadAsJSON = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ip_analysis.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    handleDownloadClose();
  };

  const downloadAsCSV = () => {
    const headers = ['IP', 'City', 'Country', 'Continent', 'Latitude', 'Longitude', 
                    'Accuracy Radius', 'ISP', 'Organization', 'Threat Level', 'Tags'];
    const rows = results.map(r => [
      r.ip,
      r.city,
      r.country,
      r.continent,
      r.location.latitude,
      r.location.longitude,
      r.location.accuracy_radius,
      r.isp,
      r.organization,
      r.reputation.threatLevel,
      r.reputation.tags.join(';')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        cell ? `"${cell.toString().replace(/"/g, '""')}"` : '""'
      ).join(','))
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ip_analysis.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    handleDownloadClose();
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
                  multiline
                  rows={4}
                  label="Enter IP Address(es)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  variant="outlined"
                  placeholder="Enter IPs (one per line, or separated by commas)&#10;Example:&#10;8.8.8.8&#10;1.1.1.1&#10;9.9.9.9"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadFileIcon />}
                >
                  Upload IP List
                  <input
                    type="file"
                    hidden
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                  />
                </Button>
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
              {progress > 0 && progress < 100 && (
                <Grid item xs={12}>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress} 
                    sx={{ mt: 2 }}
                  />
                </Grid>
              )}
            </Grid>
          </form>

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              Error: {error}
            </Typography>
          )}

          {results.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadClick}
                  disabled={!results.length}
                >
                  Download Results
                </Button>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleDownloadClose}
                >
                  <MenuItem onClick={downloadAsJSON}>Download as JSON</MenuItem>
                  <MenuItem onClick={downloadAsCSV}>Download as CSV</MenuItem>
                </Menu>
              </Box>
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