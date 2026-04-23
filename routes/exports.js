// backend/routes/exports.js - PDF and Excel Export Routes
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Package = require('../models/Package');
const Request = require('../models/Request');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Create exports directory if it doesn't exist
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
}

// @route   GET /api/exports/customers/pdf
// @desc    Export customers list as PDF
// @access  Private (Admin)
router.get('/customers/pdf', protect, authorize('admin'), async (req, res) => {
    try {
        const customers = await Customer.find({}).sort({ registrationDate: -1 });
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        const filename = `customers-export-${Date.now()}.pdf`;
        const filePath = path.join(exportsDir, filename);
        
        // Pipe to file
        doc.pipe(fs.createWriteStream(filePath));
        
        // Add content
        doc.fontSize(20).text('Linknet Fiber - Customer Report', { align: 'center' });
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        
        // Summary section
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter(c => c.accountStatus === 'active').length;
        const totalRevenue = customers.reduce((sum, c) => sum + (c.totalMonthlyCost || 0), 0);
        
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(11).text(`Total Customers: ${totalCustomers}`);
        doc.text(`Active Customers: ${activeCustomers}`);
        doc.text(`Total Monthly Revenue: KES ${totalRevenue.toLocaleString()}`);
        doc.moveDown();
        
        // Customer table
        doc.fontSize(14).text('Customer Details', { underline: true });
        doc.moveDown(0.5);
        
        // Table headers
        const tableTop = doc.y;
        const headers = ['Customer ID', 'Name', 'Email', 'Phone', 'Package', 'Status', 'Monthly Cost'];
        const columnWidths = [80, 80, 80, 70, 70, 50, 60];
        let currentX = 50;
        
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, currentX, tableTop, { width: columnWidths[i] });
            currentX += columnWidths[i];
        });
        
        // Table rows
        doc.font('Helvetica');
        let currentY = tableTop + 20;
        
        customers.forEach(customer => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
            
            currentX = 50;
            const row = [
                customer.customerId,
                customer.fullname,
                customer.email,
                customer.phone,
                customer.currentPackage || 'N/A',
                customer.accountStatus,
                `KES ${customer.totalMonthlyCost || 0}`
            ];
            
            row.forEach((cell, i) => {
                doc.text(cell, currentX, currentY, { width: columnWidths[i] });
                currentX += columnWidths[i];
            });
            
            currentY += 20;
        });
        
        // Finalize PDF
        doc.end();
        
        // Wait for PDF to be created, then send
        doc.on('end', () => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error('PDF send error:', err);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to generate PDF'
                    });
                } else {
                    // Clean up file after sending
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
                    });
                }
            });
        });
        
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export PDF'
        });
    }
});

// @route   GET /api/exports/customers/excel
// @desc    Export customers list as Excel
// @access  Private (Admin)
router.get('/customers/excel', protect, authorize('admin'), async (req, res) => {
    try {
        const customers = await Customer.find({}).sort({ registrationDate: -1 });
        
        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Customers');
        
        // Add headers
        worksheet.columns = [
            { header: 'Customer ID', key: 'customerId', width: 20 },
            { header: 'Full Name', key: 'fullname', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'ID Number', key: 'idNumber', width: 15 },
            { header: 'County', key: 'address.county', width: 15 },
            { header: 'Estate', key: 'address.estate', width: 20 },
            { header: 'Current Package', key: 'currentPackage', width: 20 },
            { header: 'Account Status', key: 'accountStatus', width: 15 },
            { header: 'Monthly Cost', key: 'totalMonthlyCost', width: 15 },
            { header: 'Registration Date', key: 'registrationDate', width: 20 },
            { header: 'Last Payment Date', key: 'lastPaymentDate', width: 20 },
            { header: 'Outstanding Balance', key: 'outstandingBalance', width: 18 }
        ];
        
        // Add data
        customers.forEach(customer => {
            worksheet.addRow({
                customerId: customer.customerId,
                fullname: customer.fullname,
                email: customer.email,
                phone: customer.phone,
                idNumber: customer.idNumber,
                'address.county': customer.address?.county || '',
                'address.estate': customer.address?.estate || '',
                currentPackage: customer.currentPackage || 'N/A',
                accountStatus: customer.accountStatus,
                totalMonthlyCost: customer.totalMonthlyCost || 0,
                registrationDate: customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString() : '',
                lastPaymentDate: customer.lastPaymentDate ? new Date(customer.lastPaymentDate).toLocaleDateString() : '',
                outstandingBalance: customer.outstandingBalance || 0
            });
        });
        
        // Add summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 20 }
        ];
        
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter(c => c.accountStatus === 'active').length;
        const totalRevenue = customers.reduce((sum, c) => sum + (c.totalMonthlyCost || 0), 0);
        const totalBalance = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
        
        summarySheet.addRow({ metric: 'Total Customers', value: totalCustomers });
        summarySheet.addRow({ metric: 'Active Customers', value: activeCustomers });
        summarySheet.addRow({ metric: 'Inactive Customers', value: totalCustomers - activeCustomers });
        summarySheet.addRow({ metric: 'Total Monthly Revenue', value: `KES ${totalRevenue.toLocaleString()}` });
        summarySheet.addRow({ metric: 'Total Outstanding Balance', value: `KES ${totalBalance.toLocaleString()}` });
        summarySheet.addRow({ metric: 'Average Monthly Cost', value: `KES ${Math.round(totalRevenue / totalCustomers)}` });
        
        // Style headers
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E4D8C' } };
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E4D8C' } };
        
        // Generate filename
        const filename = `customers-export-${Date.now()}.xlsx`;
        const filePath = path.join(exportsDir, filename);
        
        // Save workbook
        await workbook.xlsx.writeFile(filePath);
        
        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Excel send error:', err);
                res.status(500).json({
                    success: false,
                    error: 'Failed to generate Excel file'
                });
            } else {
                // Clean up file after sending
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) console.error('File cleanup error:', unlinkErr);
                });
            }
        });
        
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export Excel'
        });
    }
});

// @route   GET /api/exports/revenue/pdf
// @desc    Export revenue report as PDF
// @access  Private (Admin)
router.get('/revenue/pdf', protect, authorize('admin'), async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        const customers = await Customer.find({ accountStatus: 'active' });
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        const filename = `revenue-report-${Date.now()}.pdf`;
        const filePath = path.join(exportsDir, filename);
        
        // Pipe to file
        doc.pipe(fs.createWriteStream(filePath));
        
        // Add content
        doc.fontSize(20).text('Linknet Fiber - Revenue Report', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, { align: 'center' });
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        
        // Revenue summary
        const totalRevenue = customers.reduce((sum, c) => sum + (c.totalMonthlyCost || 0), 0);
        const projectedAnnual = totalRevenue * 12;
        
        doc.fontSize(14).text('Revenue Summary', { underline: true });
        doc.fontSize(11).text(`Total Monthly Revenue: KES ${totalRevenue.toLocaleString()}`);
        doc.text(`Projected Annual Revenue: KES ${projectedAnnual.toLocaleString()}`);
        doc.text(`Average Revenue per Customer: KES ${Math.round(totalRevenue / customers.length)}`);
        doc.moveDown();
        
        // Revenue by package
        const packageRevenue = {};
        customers.forEach(customer => {
            const pkg = customer.currentPackage || 'Unknown';
            if (!packageRevenue[pkg]) {
                packageRevenue[pkg] = { count: 0, revenue: 0 };
            }
            packageRevenue[pkg].count++;
            packageRevenue[pkg].revenue += customer.totalMonthlyCost || 0;
        });
        
        doc.fontSize(14).text('Revenue by Package', { underline: true });
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const headers = ['Package', 'Customers', 'Revenue', 'Avg. Revenue'];
        const columnWidths = [80, 60, 70, 70];
        let currentX = 50;
        
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, currentX, tableTop, { width: columnWidths[i] });
            currentX += columnWidths[i];
        });
        
        doc.font('Helvetica');
        let currentY = tableTop + 20;
        
        Object.entries(packageRevenue).forEach(([pkg, data]) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
            
            currentX = 50;
            const row = [
                pkg,
                data.count.toString(),
                `KES ${data.revenue.toLocaleString()}`,
                `KES ${Math.round(data.revenue / data.count)}`
            ];
            
            row.forEach((cell, i) => {
                doc.text(cell, currentX, currentY, { width: columnWidths[i] });
                currentX += columnWidths[i];
            });
            
            currentY += 20;
        });
        
        // Finalize PDF
        doc.end();
        
        // Wait for PDF to be created, then send
        doc.on('end', () => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error('PDF send error:', err);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to generate PDF'
                    });
                } else {
                    // Clean up file after sending
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
                    });
                }
            });
        });
        
    } catch (error) {
        console.error('Revenue PDF export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export revenue PDF'
        });
    }
});

// @route   GET /api/exports/requests/pdf
// @desc    Export installation requests as PDF
// @access  Private (Admin)
router.get('/requests/pdf', protect, authorize('admin'), async (req, res) => {
    try {
        const requests = await Request.find({}).sort({ createdAt: -1 }).populate('customerId', 'fullname email phone');
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        const filename = `installation-requests-${Date.now()}.pdf`;
        const filePath = path.join(exportsDir, filename);
        
        // Pipe to file
        doc.pipe(fs.createWriteStream(filePath));
        
        // Add content
        doc.fontSize(20).text('Linknet Fiber - Installation Requests', { align: 'center' });
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        
        // Summary
        const totalRequests = requests.length;
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        const completedRequests = requests.filter(r => r.status === 'completed').length;
        
        doc.fontSize(14).text('Request Summary', { underline: true });
        doc.fontSize(11).text(`Total Requests: ${totalRequests}`);
        doc.text(`Pending Requests: ${pendingRequests}`);
        doc.text(`Completed Requests: ${completedRequests}`);
        doc.text(`Completion Rate: ${totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0}%`);
        doc.moveDown();
        
        // Requests table
        doc.fontSize(14).text('Request Details', { underline: true });
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const headers = ['Request ID', 'Customer', 'Phone', 'Location', 'Status', 'Created'];
        const columnWidths = [70, 70, 70, 80, 50, 60];
        let currentX = 50;
        
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, currentX, tableTop, { width: columnWidths[i] });
            currentX += columnWidths[i];
        });
        
        doc.font('Helvetica');
        let currentY = tableTop + 20;
        
        requests.forEach(request => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
            
            currentX = 50;
            const row = [
                request.requestId,
                request.customerId?.fullname || 'N/A',
                request.customerId?.phone || 'N/A',
                `${request.address?.county}, ${request.address?.estate}`,
                request.status,
                request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''
            ];
            
            row.forEach((cell, i) => {
                doc.text(cell, currentX, currentY, { width: columnWidths[i] });
                currentX += columnWidths[i];
            });
            
            currentY += 20;
        });
        
        // Finalize PDF
        doc.end();
        
        // Wait for PDF to be created, then send
        doc.on('end', () => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error('PDF send error:', err);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to generate PDF'
                    });
                } else {
                    // Clean up file after sending
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
                    });
                }
            });
        });
        
    } catch (error) {
        console.error('Requests PDF export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export requests PDF'
        });
    }
});

module.exports = router;
