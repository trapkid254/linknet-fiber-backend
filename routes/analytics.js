// backend/routes/analytics.js - Analytics and Monitoring Routes
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Package = require('../models/Package');
const Request = require('../models/Request');

// @route   GET /api/analytics/dashboard
// @desc    Get analytics dashboard data
// @access  Private (Admin)
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
    try {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);

        // Customer analytics
        const totalCustomers = await Customer.countDocuments();
        const activeCustomers = await Customer.countDocuments({ accountStatus: 'active' });
        const newCustomersThisMonth = await Customer.countDocuments({
            registrationDate: { $gte: lastMonth }
        });
        const newCustomersThisYear = await Customer.countDocuments({
            registrationDate: { $gte: lastYear }
        });

        // Package analytics
        const packages = await Package.find({ active: true });
        const packageDistribution = await Customer.aggregate([
            { $match: { accountStatus: 'active', currentPackage: { $ne: null } } },
            { $group: { _id: '$currentPackage', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Revenue analytics
        const monthlyRevenue = await Customer.aggregate([
            { $match: { accountStatus: 'active' } },
            { $group: { _id: null, total: { $sum: '$totalMonthlyCost' } } }
        ]);
        
        const totalRevenue = monthlyRevenue[0]?.total || 0;
        const projectedAnnualRevenue = totalRevenue * 12;

        // Request analytics
        const totalRequests = await Request.countDocuments();
        const pendingRequests = await Request.countDocuments({ status: 'pending' });
        const completedRequests = await Request.countDocuments({ status: 'completed' });
        const requestsThisMonth = await Request.countDocuments({
            createdAt: { $gte: lastMonth }
        });

        // Growth metrics
        const customerGrowthRate = newCustomersThisYear > 0 ? 
            ((newCustomersThisMonth / newCustomersThisYear) * 100).toFixed(2) : 0;

        // Geographic distribution
        const geographicDistribution = await Customer.aggregate([
            { $match: { accountStatus: 'active' } },
            { $group: { _id: '$address.county', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Service performance
        const avgMonthlyCost = await Customer.aggregate([
            { $match: { accountStatus: 'active' } },
            { $group: { _id: null, avgCost: { $avg: '$totalMonthlyCost' } } }
        ]);

        res.json({
            success: true,
            data: {
                customers: {
                    total: totalCustomers,
                    active: activeCustomers,
                    newThisMonth: newCustomersThisMonth,
                    newThisYear: newCustomersThisYear,
                    growthRate: parseFloat(customerGrowthRate),
                    activeRate: totalCustomers > 0 ? ((activeCustomers / totalCustomers) * 100).toFixed(2) : 0
                },
                packages: {
                    total: packages.length,
                    distribution: packageDistribution,
                    avgMonthlyCost: avgMonthlyCost[0]?.avgCost?.toFixed(2) || 0
                },
                revenue: {
                    monthly: totalRevenue,
                    projectedAnnual: projectedAnnualRevenue,
                    perCustomer: activeCustomers > 0 ? (totalRevenue / activeCustomers).toFixed(2) : 0
                },
                requests: {
                    total: totalRequests,
                    pending: pendingRequests,
                    completed: completedRequests,
                    newThisMonth: requestsThisMonth,
                    completionRate: totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(2) : 0
                },
                geographic: geographicDistribution
            }
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics data'
        });
    }
});

// @route   GET /api/analytics/revenue
// @desc    Get detailed revenue analytics
// @access  Private (Admin)
router.get('/revenue', protect, authorize('admin'), async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        
        let groupBy;
        switch (period) {
            case 'daily':
                groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$registrationDate' } };
                break;
            case 'weekly':
                groupBy = { $week: '$registrationDate' };
                break;
            case 'monthly':
                groupBy = { $dateToString: { format: '%Y-%m', date: '$registrationDate' } };
                break;
            case 'yearly':
                groupBy = { $dateToString: { format: '%Y', date: '$registrationDate' } };
                break;
            default:
                groupBy = { $dateToString: { format: '%Y-%m', date: '$registrationDate' } };
        }

        const revenueTrend = await Customer.aggregate([
            { $match: { accountStatus: 'active' } },
            {
                $group: {
                    _id: groupBy,
                    revenue: { $sum: '$totalMonthlyCost' },
                    customers: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Package revenue breakdown
        const packageRevenue = await Customer.aggregate([
            { $match: { accountStatus: 'active', currentPackage: { $ne: null } } },
            {
                $group: {
                    _id: '$currentPackage',
                    revenue: { $sum: '$totalMonthlyCost' },
                    customers: { $sum: 1 }
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        res.json({
            success: true,
            data: {
                trend: revenueTrend,
                packageBreakdown: packageRevenue
            }
        });
    } catch (error) {
        console.error('Error fetching revenue analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch revenue analytics'
        });
    }
});

// @route   GET /api/analytics/customers
// @desc    Get customer analytics
// @access  Private (Admin)
router.get('/customers', protect, authorize('admin'), async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        
        // Customer acquisition trend
        let groupBy;
        switch (period) {
            case 'daily':
                groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$registrationDate' } };
                break;
            case 'weekly':
                groupBy = { $week: '$registrationDate' };
                break;
            case 'monthly':
                groupBy = { $dateToString: { format: '%Y-%m', date: '$registrationDate' } };
                break;
            case 'yearly':
                groupBy = { $dateToString: { format: '%Y', date: '$registrationDate' } };
                break;
            default:
                groupBy = { $dateToString: { format: '%Y-%m', date: '$registrationDate' } };
        }

        const acquisitionTrend = await Customer.aggregate([
            {
                $group: {
                    _id: groupBy,
                    customers: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Customer status distribution
        const statusDistribution = await Customer.aggregate([
            {
                $group: {
                    _id: '$accountStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Customer retention (simplified)
        const retentionData = await Customer.aggregate([
            { $match: { accountStatus: 'active' } },
            {
                $group: {
                    _id: null,
                    avgAge: { $avg: { $subtract: [new Date(), '$registrationDate'] } },
                    totalCustomers: { $sum: 1 }
                }
            }
        ]);

        // Geographic distribution
        const geographicDistribution = await Customer.aggregate([
            { $match: { accountStatus: 'active' } },
            {
                $group: {
                    _id: '$address.county',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
        ]);

        res.json({
            success: true,
            data: {
                acquisitionTrend,
                statusDistribution,
                retention: {
                    avgCustomerAge: retentionData[0]?.avgAge ? Math.floor(retentionData[0].avgAge / (1000 * 60 * 60 * 24)) : 0,
                    totalActiveCustomers: retentionData[0]?.totalCustomers || 0
                },
                geographicDistribution
            }
        });
    } catch (error) {
        console.error('Error fetching customer analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer analytics'
        });
    }
});

// @route   GET /api/analytics/performance
// @desc    Get system performance metrics
// @access  Private (Admin)
router.get('/performance', protect, authorize('admin'), async (req, res) => {
    try {
        // Request processing metrics
        const requestMetrics = await Request.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgProcessingTime: { $avg: '$processingTime' }
                }
            }
        ]);

        // Service request trends
        const requestTrend = await Request.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 30 }
        ]);

        // Package performance
        const packagePerformance = await Customer.aggregate([
            { $match: { accountStatus: 'active', currentPackage: { $ne: null } } },
            {
                $group: {
                    _id: '$currentPackage',
                    customers: { $sum: 1 },
                    avgRevenue: { $avg: '$totalMonthlyCost' }
                }
            },
            { $sort: { customers: -1 } }
        ]);

        // System health metrics
        const systemHealth = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform
        };

        res.json({
            success: true,
            data: {
                requests: {
                    metrics: requestMetrics,
                    trend: requestTrend
                },
                packages: packagePerformance,
                systemHealth
            }
        });
    } catch (error) {
        console.error('Error fetching performance analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch performance analytics'
        });
    }
});

// @route   POST /api/analytics/event
// @desc    Track custom analytics events
// @access  Private
router.post('/event', protect, async (req, res) => {
    try {
        const { event, data, userId } = req.body;
        
        // Log event (in production, this would go to a proper analytics service)
        const analyticsEvent = {
            event,
            data,
            userId,
            timestamp: new Date(),
            userAgent: req.get('User-Agent'),
            ip: req.ip
        };

        console.log('Analytics Event:', analyticsEvent);

        res.json({
            success: true,
            message: 'Event tracked successfully'
        });
    } catch (error) {
        console.error('Error tracking analytics event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track event'
        });
    }
});

module.exports = router;
