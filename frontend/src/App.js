import React, { useState, useMemo, useEffect } from 'react';
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
import ListSubheader from '@mui/material/ListSubheader';
import LinearProgress from '@mui/material/LinearProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { isValidIP, getIPTags, cleanIPList } from './utils/ipUtils';
import AdUnit from './components/AdUnit';

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
  const [threatFilter, setThreatFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [enableHttpBL, setEnableHttpBL] = useState(false);

  // Get unique countries and sort them
  const countries = useMemo(() => {
    const uniqueCountries = [...new Set(results.map(r => r.country))].sort();
    return ['all', ...uniqueCountries];
  }, [results]);

  // Get unique threat levels and sort them
  const threatLevels = useMemo(() => {
    const uniqueThreats = [...new Set(results.map(r => r.reputation.threatLevel))].sort();
    return ['all', ...uniqueThreats];
  }, [results]);

  // Get unique tags and sort them
  const tags = useMemo(() => {
    const uniqueTags = [...new Set(results.flatMap(r => r.reputation.tags))].sort();
    return ['all', ...uniqueTags];
  }, [results]);

  // Filter results based on selected filters
  const filteredResults = useMemo(() => {
    return results.filter(result => {
      const matchesThreat = threatFilter === 'all' || result.reputation.threatLevel === threatFilter;
      const matchesCountry = countryFilter === 'all' || result.country === countryFilter;
      const matchesTag = tagFilter === 'all' || result.reputation.tags.includes(tagFilter);
      return matchesThreat && matchesCountry && matchesTag;
    });
  }, [results, threatFilter, countryFilter, tagFilter]);

  // Reset filters when new results come in
  useEffect(() => {
    setThreatFilter('all');
    setCountryFilter('all');
    setTagFilter('all');
  }, [results]);

  const handleThreatFilterChange = (event) => {
    setThreatFilter(event.target.value);
  };

  const handleCountryFilterChange = (event) => {
    setCountryFilter(event.target.value);
  };

  const handleTagFilterChange = (event) => {
    setTagFilter(event.target.value);
  };

  // Get stats for the current filter
  const getFilterStats = () => {
    const total = filteredResults.length;
    const tagStats = filteredResults.reduce((acc, curr) => {
      curr.reputation.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {});
    return { total, tagStats };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Clean and validate IPs
      const validIPs = cleanIPList(input);
      
      if (validIPs.length === 0) {
        throw new Error('No valid IP addresses found in input');
      }

      if (validIPs.length > 50) {
        setProgress(0);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          input: validIPs.join('\n'),
          enableHttpBL: enableHttpBL 
        }),
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
        const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
        const validIPs = ips.filter(ip => isValidIP(ip));
        setInput(validIPs.join('\n'));
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
    const dataStr = JSON.stringify(filteredResults, null, 2);
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
    const rows = filteredResults.map(r => [
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
      r.reputation.tags.join(' | ')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        cell !== null && cell !== undefined ? `"${cell.toString().replace(/"/g, '""')}"` : '""'
      ).join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csvContentWithBOM = BOM + csvContent;

    const dataBlob = new Blob([csvContentWithBOM], { type: 'text/csv;charset=utf-8;' });
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
      <Container sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ my: 4 }}>
          <Typography variant="h1" component="h1" gutterBottom>
            IPSleuth
          </Typography>
          
          <AdUnit slot="6498742580" format="horizontal" />

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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={enableHttpBL}
                        onChange={(e) => setEnableHttpBL(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Enable Project Honey Pot Lookup"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    ⚠️ May slow down results. Limited to 10k queries/day.
                  </Typography>
                </Box>
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
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack direction="row" spacing={2} sx={{ flexGrow: 1, mr: 2 }}>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Threat Level</InputLabel>
                    <Select
                      value={threatFilter}
                      label="Threat Level"
                      onChange={handleThreatFilterChange}
                    >
                      {threatLevels.map(level => (
                        <MenuItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Country</InputLabel>
                    <Select
                      value={countryFilter}
                      label="Country"
                      onChange={handleCountryFilterChange}
                    >
                      {countries.map(country => (
                        <MenuItem key={country} value={country}>
                          {country === 'all' ? 'All Countries' : country}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Tags</InputLabel>
                    <Select
                      value={tagFilter}
                      label="Tags"
                      onChange={handleTagFilterChange}
                    >
                      <MenuItem value="all">All IPs</MenuItem>
                      <MenuItem value="public_ip">Public IPs Only</MenuItem>
                      <ListSubheader>Special Ranges</ListSubheader>
                      {tags
                        .filter(tag => tag !== 'all' && tag !== 'public_ip')
                        .sort((a, b) => {
                          // Sort malicious and tor_exit to the top
                          if (a === 'malicious') return -1;
                          if (b === 'malicious') return 1;
                          if (a === 'tor_exit') return -1;
                          if (b === 'tor_exit') return 1;
                          return a.localeCompare(b);
                        })
                        .map(tag => (
                          <MenuItem key={tag} value={tag}>
                            {tag.split('_').map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </MenuItem>
                        ))
                      }
                    </Select>
                  </FormControl>
                </Stack>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadClick}
                  disabled={!filteredResults.length}
                >
                  Download Results
                </Button>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Showing {filteredResults.length} of {results.length} IPs
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {Object.entries(getFilterStats().tagStats).map(([tag, count]) => (
                    <Chip
                      key={tag}
                      label={`${tag.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}: ${count}`}
                      color={
                        tag === 'malicious' ? 'error' :
                        tag === 'tor_exit' ? 'warning' :
                        tag === 'public_ip' ? 'success' :
                        tag === 'malformed_ip' ? 'error' :
                        tag === 'httpbl_search_engine' ? 'error' :
                        'default'
                      }
                      variant={tagFilter === tag ? 'filled' : 'outlined'}
                      onClick={() => setTagFilter(tag)}
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Stack>
              </Box>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleDownloadClose}
              >
                <MenuItem onClick={downloadAsJSON}>Download as JSON</MenuItem>
                <MenuItem onClick={downloadAsCSV}>Download as CSV</MenuItem>
              </Menu>
              {filteredResults.map((result, index) => (
                <React.Fragment key={index}>
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
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
                        {result.reputation.httpbl && (
                          <>
                            <Typography>
                              Project Honey Pot Data:
                            </Typography>
                            <Typography component="div" sx={{ pl: 2 }}>
                              • Last Seen: {result.reputation.httpbl.lastSeen} days ago
                              <br />
                              • Threat Score: {result.reputation.httpbl.threatScore}/255
                              <br />
                              • Types: {result.reputation.httpbl.types.map(t => 
                                t.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                              ).join(', ')}
                            </Typography>
                          </>
                        )}
                      </>
                    )}
                  </Box>
                  {(index + 1) % 10 === 0 && <AdUnit slot="2868550968" />}
                </React.Fragment>
              ))}
            </Box>
          )}
        </Box>

        <AdUnit slot="2172484767" format="horizontal" />

        <Box 
          component="footer" 
          sx={{ 
            mt: 'auto', 
            py: 3, 
            textAlign: 'center',
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Made with 💝 by human persistence and AI brilliance.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Special thanks to{' '}
            <Link 
              href="https://www.cursor.com" 
              target="_blank" 
              rel="noopener noreferrer"
              color="primary"
            >
              Cursor.ai
            </Link>
            {' '}for making coding fun for everyone!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Built overnight and proudly open-sourced at{' '}
            <Link href="https://github.com/anindyar/ipsleuth">GitHub</Link>
            . Hope the AI doesn't mind me sharing its work! 😉
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
            🏆 Standing on the Shoulders of Giants 🏆
          </Typography>
          
          <Stack spacing={2} sx={{ mt: 2, textAlign: 'left' }}>
            <Box>
              <Typography variant="subtitle2" color="primary">
                🌍 GeoLite2 by MaxMind
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Powering our IP geolocation with scary accuracy! Check them out at{' '}
                <Link href="https://www.maxmind.com" target="_blank" rel="noopener">MaxMind</Link>
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" color="primary">
                🍯 Project Honey Pot
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The sweetest way to catch bad actors! Learn more at{' '}
                <Link href="https://www.projecthoneypot.org" target="_blank" rel="noopener">Project Honey Pot</Link>
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" color="primary">
                🔥 FireHOL IP Lists
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Keeping the internet's temperature in check since 2014!{' '}
                <Link href="https://iplists.firehol.org" target="_blank" rel="noopener">FireHOL</Link>
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" color="primary">
                🧅 Tor Exit Nodes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Because sometimes privacy needs layers! Data from{' '}
                <Link href="https://metrics.torproject.org" target="_blank" rel="noopener">Tor Project</Link>
              </Typography>
            </Box>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
            🎵 Servers don't run on hopes and dreams... yet! 🌟
            <br />
            If you're feeling generous and want to keep this free tool alive, toss a coin to your IP checker:
            <br />
            <Box component="span" sx={{ 
              fontFamily: 'monospace', 
              bgcolor: 'background.paper', 
              px: 1, 
              py: 0.5, 
              borderRadius: 1,
              display: 'inline-block',
              mt: 1,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
            onClick={(e) => {
              navigator.clipboard.writeText('0xd077045df46e66d58fcb232b815d86f872b7ab72');
              e.currentTarget.innerText = 'Copied! 🎉';
              setTimeout(() => {
                e.currentTarget.innerText = '0xd077045df46e66d58fcb232b815d86f872b7ab72';
              }, 1500);
            }}
            >
              0xd077045df46e66d58fcb232b815d86f872b7ab72
            </Box>
            <br />
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              (Click to copy the ETH address. Every little bit helps! 💖)
            </Typography>
          </Typography>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;