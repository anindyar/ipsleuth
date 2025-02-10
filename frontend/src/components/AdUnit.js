import React, { useEffect } from 'react';
import Box from '@mui/material/Box';

const AdUnit = ({ slot, format = 'auto' }) => {
  useEffect(() => {
    try {
      // Check if AdSense is loaded
      if (window.adsbygoogle) {
        console.log(`Initializing ad slot: ${slot}`);
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } else {
        console.warn('AdSense not loaded yet');
      }
    } catch (err) {
      console.error(`Error loading AdSense for slot ${slot}:`, err);
    }
  }, [slot]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        my: 2,
        minHeight: format === 'auto' ? '100px' : 'auto', // Prevent layout shift
        border: process.env.NODE_ENV === 'development' ? '1px dashed grey' : 'none' // Visual debug in dev
      }}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          textAlign: 'center',
          overflow: 'hidden',
          width: '100%',
          height: format === 'auto' ? 'auto' : '90px'
        }}
        data-ad-client="ca-pub-5292876396544043"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        data-adtest={process.env.NODE_ENV === 'development' ? 'on' : 'off'} // Test ads in dev
      />
    </Box>
  );
};

export default AdUnit; 