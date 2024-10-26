const router = require('express').Router();
const axios = require('axios');
const Transaction = require('../models/transactionModel');

const getMonthQuery = (month) => 
    month === 0 ? {} : { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } };

// Utility function to handle pagination
const getPagination = (req) => {
    const page = Math.max(0, parseInt(req.query.page) - 1) || 0;
    const limit = !isNaN(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 10;
    return { skip: page * limit, limit };
};

// Get transaction data by month
router.get('/transactions', async (req, res) => {
    try {
        const { skip, limit } = getPagination(req);
        const search = req.query.search || '';
        const month = !isNaN(parseInt(req.query.month)) ? parseInt(req.query.month) : 3;

        const searchConfig = {
            $and: [
                getMonthQuery(month),
                {
                    $or: [
                        { title: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } },
                        { price: { $regex: search, $options: 'i' } },
                    ]
                }
            ]
        };

        const [data, totalCount] = await Promise.all([
            Transaction.find(searchConfig).skip(skip).limit(limit),
            Transaction.countDocuments(searchConfig)
        ]);

        res.status(200).json({ success: true, totalCount, page: skip / limit + 1, limit, month, transactions: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get statistics by month
router.get('/statistics', async (req, res) => {
    try {
        const month = !isNaN(parseInt(req.query.month)) ? parseInt(req.query.month) : 3;
        const monthQuery = getMonthQuery(month);
        const data = await Transaction.find(monthQuery, { _id: 0, price: 1, sold: 1 });

        const response = data.reduce((acc, curr) => {
            const currPrice = parseFloat(curr.price);
            acc.totalSale += curr.sold ? currPrice : 0;
            acc.soldCount += curr.sold ? 1 : 0;
            acc.unsoldCount += !curr.sold ? 1 : 0;
            return acc;
        }, { totalCount: data.length, totalSale: 0, soldCount: 0, unsoldCount: 0 });

        response.totalSale = response.totalSale.toFixed(2);
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get data for bar chart
router.get('/bar-chart', async (req, res) => {
    try {
        const month = !isNaN(parseInt(req.query.month)) ? parseInt(req.query.month) : 3;
        const monthQuery = getMonthQuery(month);
        const data = await Transaction.find(monthQuery, { _id: 0, price: 1 });

        const accumulator = Array.from({ length: 10 }, (_, i) => {
            const range = i === 9 ? '901-above' : `${i * 100}-${i === 0 ? 100 : (i + 1) * 100 - 1}`;
            return { range, count: 0 };
        });

        data.forEach(curr => {
            const currPrice = parseFloat(curr.price);
            const priceRange = currPrice > 900 ? '901-above' : `${Math.floor(currPrice / 100) * 100}-${Math.floor(currPrice / 100) * 100 + 99}`;
            const bucket = accumulator.find(r => r.range === priceRange);
            if (bucket) bucket.count++;
        });

        res.status(200).json(Object.fromEntries(accumulator.map(r => [r.range, r.count])));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get data for pie chart
router.get('/pie-chart', async (req, res) => {
    try {
        const month = !isNaN(parseInt(req.query.month)) ? parseInt(req.query.month) : 3;
        const monthQuery = getMonthQuery(month);
        const data = await Transaction.find(monthQuery, { _id: 0, category: 1 });

        const response = data.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
            return acc;
        }, {});

        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get combined data from all APIs
router.get('/combined-data', async (req, res) => {
    try {
        const baseURL = `${req.protocol}://${req.get('host')}`;
        const month = req.query.month || 3;

        const [stats, barChart, pieChart] = await Promise.all([
            axios.get(`${baseURL}/statistics?month=${month}`),
            axios.get(`${baseURL}/bar-chart?month=${month}`),
            axios.get(`${baseURL}/pie-chart?month=${month}`)
        ]);

        res.status(200).json({
            statsData: stats.data,
            barChartData: barChart.data,
            pieChartData: pieChart.data
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
