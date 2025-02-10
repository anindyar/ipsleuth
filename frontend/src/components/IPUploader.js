import React, { useState } from 'react';
import { 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Divider,
  Alert
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';

const IPUploader = ({ onIPsSubmit }) => {
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      setError('Please enter IP addresses');
      return;
    }
    onIPsSubmit(textInput, 'text');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        setError('File size too large. Please upload a smaller file.');
        return;
      }
      setFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        onIPsSubmit(e.target.result, 'file');
      };
      reader.readAsText(file);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload IP Addresses
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          placeholder="Enter IP addresses (one per line, max 1000 IPs)"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          startIcon={<ContentPasteIcon />}
          onClick={handleTextSubmit}
          sx={{ mr: 2 }}
        >
          Analyze Pasted IPs
        </Button>
      </Box>

      <Divider sx={{ my: 2 }}>OR</Divider>

      <Box>
        <input
          accept=".txt,.csv,.pcap"
          style={{ display: 'none' }}
          id="file-upload"
          type="file"
          onChange={handleFileUpload}
        />
        <label htmlFor="file-upload">
          <Button
            variant="outlined"
            component="span"
            startIcon={<CloudUploadIcon />}
          >
            Upload File
          </Button>
        </label>
        {file && <Typography variant="body2" sx={{ mt: 1 }}>{file.name}</Typography>}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
};

export default IPUploader; 