import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const PrivacyPolicy = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Privacy Policy</Typography>
      <Typography paragraph>
        This website uses Google AdSense to display advertisements. Google AdSense may use cookies and web beacons to help serve and manage ads across the web. No personally identifiable information you give will be provided to them for cookie or web beacon use.
      </Typography>
      <Typography paragraph>
        Google's use of advertising cookies enables it and its partners to serve ads based on your visit to this site and/or other sites on the Internet.
      </Typography>
      <Typography paragraph>
        You can opt out of personalized advertising by visiting Google's Ads Settings page.
      </Typography>
    </Box>
  );
};

export default PrivacyPolicy; 