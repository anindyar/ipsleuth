import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Button,
  Box
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const IPTable = ({ data, onSort, onPageChange, page, rowsPerPage = 100 }) => {
  const columns = [
    { id: 'ip', label: 'IP Address' },
    { id: 'country', label: 'Country' },
    { id: 'city', label: 'City' },
    { id: 'isp', label: 'ISP' },
    { id: 'reputation', label: 'Reputation Score' },
    { id: 'lastReport', label: 'Last Reported' },
  ];

  const handleExportCSV = () => {
    const headers = columns.map(column => column.label);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        columns.map(column => row[column.id]).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ip-analysis.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Paper elevation={3}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportCSV}
        >
          Export CSV
        </Button>
      </Box>
      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id}>
                  <TableSortLabel
                    onClick={() => onSort(column.id)}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row, index) => (
                <TableRow hover key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      {row[column.id]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        rowsPerPageOptions={[100]}
      />
    </Paper>
  );
};

export default IPTable; 