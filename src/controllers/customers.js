// src/controllers/customers.js

import connectDB from '../db/index.js';  

export const searchCustomers = async (req, res) => {
  const { query } = req.query;

  try {
      const connection = await connectDB(); // Connect to the database
      let results;

      // Search across multiple fields: first_name, last_name, phone_no, email_id, C_unique_id
      const sql = `
          SELECT * FROM customers 
          WHERE first_name LIKE ? 
          OR middle_name LIKE ? 
          OR last_name LIKE ? 
          OR gender LIKE ? 
          OR phone_no_primary LIKE ?
          OR whatsapp_num LIKE ?
          OR phone_no_secondary LIKE ?
          OR email_id LIKE ?
          OR C_unique_id LIKE ?
          OR agent_name LIKE ?
          OR address LIKE ?
          OR country LIKE ?
          OR contact_type LIKE ?
          OR company_name LIKE ?
          OR disposition LIKE ?
      `;
      
      const searchParam = `%${query}%`;
      const [rows] = await connection.execute(sql, [
          searchParam,  
          searchParam,  
          searchParam,  
          searchParam,  
          searchParam,  
          searchParam,  
          searchParam,   
          searchParam,  
          searchParam,  
          searchParam,  
          searchParam,    
          searchParam,   
          searchParam,  
          searchParam,  
          searchParam  
      ]);

      results = rows;

      res.status(200).json(results);
  } catch (error) {
      console.error('Error searching customers:', error);
      res.status(500).json({ message: 'Failed to search customers' });
  }
};

// *****************

export const getAllCustomers = async (req, res) => {
  try {
      const connection = await connectDB();
      const query = `SELECT * FROM customers ORDER BY last_updated DESC`;  
      const [rows] = await connection.execute(query);
      
      res.status(200).json(rows);
  } catch (error) {
      console.error('Error fetching last updated customers:', error);
      res.status(500).json({ message: 'Failed to fetch records' });
  }
};

// *****************

export const updateCustomer = async (req, res) => {
  const C_unique_id = req.params.id;
  const {
    first_name, middle_name, last_name,
    phone_no_primary, whatsapp_num, phone_no_secondary, 
    email_id, gender, address, country, company_name, 
    contact_type, source, disposition, agent_name,
    comment,
  } = req.body;

  try {
    const connection = await connectDB(); 

    // Validating gender to ensure it's one of the allowed ENUM values
    const validGender = ['male', 'female', 'other'];
    const validatedGender = validGender.includes(gender) ? gender : 'male'; // Default to 'male'

    // Extract 10-digit numbers from phone numbers
    const extractNumber = (number) => {
      if (!number) return ''; // Handle null or undefined
      // Remove any non-digit characters and return the last 10 digits
      return number.replace(/\D/g, '').slice(-10);
    };

    const primaryNum = extractNumber(phone_no_primary);
    const whatsappNum = extractNumber(whatsapp_num);
    const secondaryNum = extractNumber(phone_no_secondary);

    // Check if any of the phone numbers or email already exist in the database
    const [existingRecords] = await connection.query(`
      SELECT phone_no_primary, whatsapp_num, email_id
      FROM customers 
      WHERE 
        (SUBSTRING(phone_no_primary, LENGTH(phone_no_primary) - 9) = ? OR
         SUBSTRING(whatsapp_num, LENGTH(whatsapp_num) - 9) = ? OR
         email_id = ?) 
         AND id != ?  -- Exclude the current customer record
    `, [primaryNum, whatsappNum, email_id, C_unique_id]);

    // Collecting errors based on existing records
    const errors = [];
    if (existingRecords.length > 0) {
      existingRecords.forEach(record => {
        if (record.phone_no_primary === primaryNum) {
          errors.push('The phone number in the Primary field is already in use!!');
        }
        if (record.whatsapp_num === whatsappNum) {
          errors.push('The phone number in the Whatsapp field is already in use!!');
        }
        if (record.email_id === email_id) {
          errors.push('The email address is already in use!!');
        }
      });
    }    

    // If there are any errors, return them
    if (errors.length > 0) {
      return res.status(409).json({ message: 'Phone number or email already in use', errors });
    }

    // Define the update query
    const query = `
      UPDATE customers  
      SET first_name = ?, middle_name = ?, last_name = ?, 
          phone_no_primary = ?, whatsapp_num = ?, phone_no_secondary = ?, 
          email_id = ?, gender = ?, address = ?, country = ?,
          company_name = ?, contact_type = ?, 
          source = ?, disposition = ?, 
          agent_name = ? , comment = ? 
      WHERE id = ?`;

    // Ensure undefined values are converted to null before executing the query
    const params = [
      first_name !== undefined ? first_name : null,
      middle_name !== undefined ? middle_name : null,
      last_name !== undefined ? last_name : null,
      phone_no_primary !== undefined ? phone_no_primary : null,
      whatsapp_num !== undefined ? whatsapp_num : null,
      phone_no_secondary !== undefined ? phone_no_secondary : null,
      email_id !== undefined ? email_id : null,
      validatedGender, // Already validated above
      address !== undefined ? address : null,
      country !== undefined ? country : null,
      company_name !== undefined ? company_name : null,
      contact_type !== undefined ? contact_type : null,
      source !== undefined ? source : null,
      disposition !== undefined ? disposition : null,
      agent_name !== undefined ? agent_name : null,
      comment !== undefined ? comment : null,
      C_unique_id,
    ];

    if (process.env.NODE_ENV === 'development') {
      console.log("Executing SQL:", query);
      console.log("With parameters:", params);
    }
    
    // Execute the query with sanitized parameters
    const [result] = await connection.execute(query, params);

    // Check if any row was updated
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer updated successfully!' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Failed to update customer' });
  }
};

// *****************

// Function to insert change log entries
const insertChangeLog = async (connection, customerId, C_unique_id, changes) => {
  for (const change of changes) {
    const { field, old_value, new_value } = change; 

    // Prepare the insert query
    const changeLogQuery = `
      INSERT INTO updates_customer (customer_id, C_unique_id, field, old_value, new_value, changed_at) 
      VALUES (?, ?, ?, ?, ?, ?)`;

    // Execute the query
    await connection.execute(changeLogQuery, [
      customerId,
      C_unique_id,
      field,
      old_value || null, 
      new_value || null, 
      new Date(), // Current timestamp
    ]);
  }
};

// *****************

// Function to fetch change history for a customer
const getChangeHistory = async (connection, customerId) => {
  const fetchHistoryQuery = `
    SELECT * FROM updates_customer 
    WHERE customer_id = ? 
    ORDER BY changed_at DESC`;

  const [changeHistory] = await connection.execute(fetchHistoryQuery, [customerId]);
  return changeHistory;
};

// *****************

// Main function to handle logging and fetching change history
export const historyCustomer = async (req, res) => {
  const { customerId, C_unique_id, changes } = req.body; // Ensure changes is an array of change objects

  // Validate input
  if (!customerId || !C_unique_id || !Array.isArray(changes)) {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  try {
    const connection = await connectDB();

    // Insert change log entries
    await insertChangeLog(connection, customerId, C_unique_id,  changes);

    // Fetch the change history for the customer
    const changeHistory = await getChangeHistory(connection, customerId);

    res.status(200).json({
      message: 'Change history recorded successfully!',
      changeHistory, // Include the change history in the response
    });
  } catch (error) {
    console.error('Error logging change history:', error);
    res.status(500).json({ message: 'Failed to log change history' });
  }
};

// *****************

// Function to handle fetching change history
export const gethistoryCustomer = async (req, res) => {
  const customerId = req.params.id;

  try {
    const connection = await connectDB();

    // Fetch change history for the specified customer
    const changeHistory = await getChangeHistory(connection, customerId);

    if (changeHistory.length === 0) {
      return res.status(404).json({ message: 'No change history found for this customer.' });
    }

    res.status(200).json({
      message: 'Change history retrieved successfully!',
      changeHistory,
    });
  } catch (error) {
    console.error('Error fetching change history:', error);
    res.status(500).json({ message: 'Failed to fetch change history' });
  }
};

// ***************

export const makeNewRecord = async (req, res) => {
  try {
    const connection = await connectDB();

    // Extract variables from req.body
    const {
      first_name, last_name, phone_no_primary, email_id, date_of_birth, address,
      company_name, contact_type, source, disposition, agent_name, whatsapp_num,
      phone_no_secondary, country, middle_name, gender, comment
    } = req.body;

    const errors = [];

    // Validate phone numbers to ensure they are provided
    if (!phone_no_primary) {
      errors.push('Primary phone number is required.');
    }

    // Function to extract the last 10 digits from a phone number
    const extractNumber = (number) => {
      if (!number) return ''; // Handle null or undefined
      const digitsOnly = number.replace(/\D/g, ''); // Remove non-digit characters
      return digitsOnly.slice(-10); // Get the last 10 digits
    };

    // Extract valid phone numbers
    const primaryNum = extractNumber(phone_no_primary);
    const whatsappNum = extractNumber(whatsapp_num);
    const secondaryNum = phone_no_secondary ? extractNumber(phone_no_secondary) : null;

    // Check if any of the phone numbers or email already exist in the database
    const [existRecords] = await connection.query(`
      SELECT phone_no_primary, whatsapp_num, email_id
      FROM customers 
      WHERE phone_no_primary = ? OR whatsapp_num = ? OR email_id = ? 
    `, [primaryNum, whatsappNum, email_id]);

    // Check which phone number fields are in use and push appropriate messages
    if (existRecords.length > 0) {
      existRecords.forEach(record => {
        if (record.phone_no_primary === primaryNum) {
          errors.push('The phone number in the Primary field is already in use!!');
        }
        if (record.whatsapp_num === whatsappNum) {
          errors.push('The phone number in the Whatsapp field is already in use!!');
        }
        if (record.email_id === email_id) {
          errors.push('The email address is already in use!!');
        }
      });
    }    

    // If there are any errors, return them
    if (errors.length > 0) {
      return res.status(409).json({ message: 'Phone number or email already in use', errors });
    }

    // Fetch the latest C_unique_id and increment it
    const [latestCustomer] = await connection.query(`
      SELECT C_unique_id 
      FROM customers 
      ORDER BY id DESC 
      LIMIT 1
    `);

    let nextUniqueId;
    if (latestCustomer.length > 0) {
      const lastUniqueId = latestCustomer[0].C_unique_id;
      const lastNumericPart = parseInt(lastUniqueId.split('_')[1]); // Extract the numeric part (e.g., 115 from MC_115)
      nextUniqueId = `MC_${lastNumericPart + 1}`;
    } else {
      // If no record exists, start with MC_1
      nextUniqueId = `MC_1`;
    }

    // Ensure the date is in the correct format (YYYY-MM-DD)
    const formattedDOB = date_of_birth ? new Date(date_of_birth).toISOString().split('T')[0] : null;

    const sql = `
      INSERT INTO customers 
      (first_name, last_name, phone_no_primary, email_id, date_of_birth, address,
      company_name, contact_type, source, disposition, agent_name, C_unique_id,
      whatsapp_num, phone_no_secondary, country, middle_name, gender, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)
    `;

    await connection.query(sql, [
      first_name, last_name, phone_no_primary, email_id, formattedDOB, address,
      company_name, contact_type, source, disposition, agent_name, nextUniqueId,
      whatsapp_num, phone_no_secondary, country, middle_name, gender, comment
    ]);

    res.status(201).json({ message: 'Record added successfully', C_unique_id: nextUniqueId });
  } catch (error) {
    console.error('Error creating new customer record:', error);
    res.status(500).json({ message: 'Error adding new record' });
  }
};

// ************

export const viewCustomer = async (req, res) => {
  const uniqueId = req.params.uniqueId; // Get the unique customer ID from the request parameters

  try {
    const connection = await connectDB(); 

    // SQL query to retrieve customer details by unique ID
    const query = `SELECT * FROM customers WHERE C_unique_id = ?`;
    const [rows] = await connection.execute(query, [uniqueId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json(rows[0]); // Return the first (and should be only) customer found
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ message: 'Failed to fetch customer details' });
  }
};

// ******************

// Function to delete from the updates_customer table
const deleteCustomerUpdates = async (connection, customerId) => {
  const deleteUpdatesQuery = `
    DELETE FROM updates_customer 
    WHERE customer_id = ?`;

  await connection.execute(deleteUpdatesQuery, [customerId]);
};

// Function to delete from the customers table
const deleteCustomerRecord = async (connection, customerId) => {
  const deleteCustomerQuery = `
    DELETE FROM customers 
    WHERE id = ?`;

  await connection.execute(deleteCustomerQuery, [customerId]);
};

// Combined function to handle deleting a customer and associated updates
export const deleteCustomer = async (req, res) => {
  const customerId = req.params.id;  // Assuming customerId is passed as a URL parameter

  try {
      if (!customerId || isNaN(customerId)) {
          return res.status(400).json({ message: 'Valid Customer ID is required' });
      }

      const connection = await connectDB();

      // Delete from updates_customer table first to ensure relational integrity
      await deleteCustomerUpdates(connection, customerId);

      // Then delete from customers table
      await deleteCustomerRecord(connection, customerId);

      res.status(200).json({ message: 'Customer and associated updates deleted successfully!' });
  } catch (error) {
      console.error('Error deleting customer and updates:', error);
      res.status(500).json({ message: 'Failed to delete customer and updates' });
  }
};
