// controllers/monday.controller.js

const axios = require('axios');

// Helper function to construct column values JSON
const constructColumnValues = (columns) => {
  const columnValues = {};
  for (const key in columns) {
    columnValues[key] = columns[key];
  }
  return JSON.stringify(columnValues);
};

// Create a new item on Monday.com
exports.createItem = async (req, res) => {
  const { stateCode, countyCode, taxYear, saleType } = req.body;

  // Input validation
  if (!stateCode || !countyCode || !taxYear || !saleType) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  // Construct the GraphQL mutation
  const mutation = `
    mutation {
      create_item (
        board_id: ${process.env.MONDAY_BOARD_ID},
        item_name: "${saleType} Sale for ${taxYear}",
        column_values: ${constructColumnValues({
          state: stateCode,
          county: countyCode,
          tax_year: taxYear,
          sale_type: saleType,
        })}
      ) {
        id
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query: mutation },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.MONDAY_API_KEY,
        },
      }
    );

    if (response.data.errors) {
      console.error('Monday.com API Errors:', response.data.errors);
      return res.status(500).json({
        message: 'Failed to create item in Monday.com.',
        errors: response.data.errors,
      });
    }

    res.status(201).json({
      message: 'Item created on Monday.com successfully.',
      itemId: response.data.data.create_item.id,
    });
  } catch (error) {
    console.error('Error creating item on Monday.com:', error);
    res.status(500).json({
      message: 'An error occurred while creating item on Monday.com.',
    });
  }
};

// Get all items from Monday.com
exports.getItems = async (req, res) => {
  const query = `
    query {
      boards(ids: ${process.env.MONDAY_BOARD_ID}) {
        items {
          id
          name
          column_values {
            id
            text
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.MONDAY_API_KEY,
        },
      }
    );

    if (response.data.errors) {
      console.error('Monday.com API Errors:', response.data.errors);
      return res.status(500).json({
        message: 'Failed to retrieve items from Monday.com.',
        errors: response.data.errors,
      });
    }

    const items = response.data.data.boards[0].items.map((item) => {
      const formattedColumns = {};
      item.column_values.forEach((col) => {
        formattedColumns[col.id] = col.text;
      });
      return {
        id: item.id,
        name: item.name,
        columns: formattedColumns,
      };
    });

    res.status(200).json({ items });
  } catch (error) {
    console.error('Error retrieving items from Monday.com:', error);
    res.status(500).json({
      message: 'An error occurred while retrieving items from Monday.com.',
    });
  }
};

// Get a single item by ID from Monday.com
exports.getItemById = async (req, res) => {
  const { id } = req.params;

  const query = `
    query {
      items(ids: ${id}) {
        id
        name
        column_values {
          id
          text
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.MONDAY_API_KEY,
        },
      }
    );

    if (response.data.errors) {
      console.error('Monday.com API Errors:', response.data.errors);
      return res.status(500).json({
        message: 'Failed to retrieve the item from Monday.com.',
        errors: response.data.errors,
      });
    }

    const item = response.data.data.items[0];
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const formattedColumns = {};
    item.column_values.forEach((col) => {
      formattedColumns[col.id] = col.text;
    });

    res.status(200).json({
      id: item.id,
      name: item.name,
      columns: formattedColumns,
    });
  } catch (error) {
    console.error('Error retrieving the item from Monday.com:', error);
    res.status(500).json({
      message: 'An error occurred while retrieving the item from Monday.com.',
    });
  }
};

// Update an existing item on Monday.com
exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { stateCode, countyCode, taxYear, saleType } = req.body;

  // At least one field must be provided for update
  if (!stateCode && !countyCode && !taxYear && !saleType) {
    return res.status(400).json({
      message: 'At least one field (stateCode, countyCode, taxYear, saleType) is required to update.',
    });
  }

  // Construct the column values to update
  const columnsToUpdate = {};
  if (stateCode) columnsToUpdate['state'] = stateCode;
  if (countyCode) columnsToUpdate['county'] = countyCode;
  if (taxYear) columnsToUpdate['tax_year'] = taxYear;
  if (saleType) columnsToUpdate['sale_type'] = saleType;

  const mutation = `
    mutation {
      change_multiple_column_values(
        board_id: ${process.env.MONDAY_BOARD_ID},
        item_id: ${id},
        column_values: ${constructColumnValues(columnsToUpdate)}
      ) {
        id
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query: mutation },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.MONDAY_API_KEY,
        },
      }
    );

    if (response.data.errors) {
      console.error('Monday.com API Errors:', response.data.errors);
      return res.status(500).json({
        message: 'Failed to update the item on Monday.com.',
        errors: response.data.errors,
      });
    }

    res.status(200).json({
      message: 'Item updated on Monday.com successfully.',
      itemId: response.data.data.change_multiple_column_values.id,
    });
  } catch (error) {
    console.error('Error updating the item on Monday.com:', error);
    res.status(500).json({
      message: 'An error occurred while updating the item on Monday.com.',
    });
  }
};

// Delete an item from Monday.com
exports.deleteItem = async (req, res) => {
  const { id } = req.params;

  const mutation = `
    mutation {
      delete_item (item_id: ${id}) {
        id
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query: mutation },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.MONDAY_API_KEY,
        },
      }
    );

    if (response.data.errors) {
      console.error('Monday.com API Errors:', response.data.errors);
      return res.status(500).json({
        message: 'Failed to delete the item from Monday.com.',
        errors: response.data.errors,
      });
    }

    res.status(200).json({
      message: 'Item deleted from Monday.com successfully.',
      itemId: response.data.data.delete_item.id,
    });
  } catch (error) {
    console.error('Error deleting the item from Monday.com:', error);
    res.status(500).json({
      message: 'An error occurred while deleting the item from Monday.com.',
    });
  }
};
