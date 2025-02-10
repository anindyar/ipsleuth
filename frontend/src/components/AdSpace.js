import React, { useEffect } from 'react';
import { Box } from '@mui/material';

const AdSpace = () => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('Error loading ad:', e);
    }
  }, []);

  return (
    <Box sx={{ minHeight: 600, width: '100%' }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="your-client-id"
        data-ad-slot="your-ad-slot"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </Box>
  );
};

export default AdSpace; 