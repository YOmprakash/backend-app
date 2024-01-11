// backend/index.js
const express = require("express");
const fetch = import("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
console.log(PORT);

app.use(express.json());
app.use(cors());

let transactionsData = [];

app.get("/api/initialize-database", async (req, res) => {
  try {
    const response = await fetch(
      "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
    );
    transactionsData = await response.json();
    console.log(transactionsData);
    res.json({ message: "Database initialized successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/transactions", (req, res) => {
  const { month, page = 1, perPage = 10, searchText } = req.query;

  let filteredTransactions = transactionsData.filter((transaction) => {
    return (
      transaction.dateOfSale.startsWith(month) &&
      (searchText
        ? transaction.title.includes(searchText) ||
          transaction.description.includes(searchText) ||
          transaction.price.toString().includes(searchText)
        : true)
    );
  });

  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + parseInt(perPage, 10);
  filteredTransactions = filteredTransactions.slice(startIndex, endIndex);

  res.json({
    transactions: filteredTransactions,
    total: transactionsData.length,
  });
});

app.get("/api/statistics", (req, res) => {
  const { month } = req.query;

  const totalSaleAmount = transactionsData
    .filter((transaction) => transaction.dateOfSale.startsWith(month))
    .reduce((sum, transaction) => sum + transaction.price, 0);

  const totalSoldItems = transactionsData.filter((transaction) =>
    transaction.dateOfSale.startsWith(month)
  ).length;

  const totalNotSoldItems = transactionsData.filter(
    (transaction) => !transaction.dateOfSale.startsWith(month)
  ).length;

  res.json({ totalSaleAmount, totalSoldItems, totalNotSoldItems });
});

app.get("/api/bar-chart", (req, res) => {
  const { month } = req.query;

  const priceRanges = [
    { min: 0, max: 100 },
    { min: 101, max: 200 },
    { min: 201, max: 300 },
    { min: 301, max: 400 },
    { min: 401, max: 500 },
    { min: 501, max: 600 },
    { min: 601, max: 700 },
    { min: 701, max: 800 },
    { min: 801, max: 900 },
    { min: 901, max: Infinity },
  ];

  const barChartData = priceRanges.map((range) => {
    const numItems = transactionsData.filter(
      (transaction) =>
        transaction.dateOfSale.startsWith(month) &&
        transaction.price >= range.min &&
        transaction.price <= range.max
    ).length;

    return {
      priceRange: `${range.min} - ${range.max}`,
      numItems,
    };
  });

  res.json(barChartData);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
