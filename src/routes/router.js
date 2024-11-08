// src/routes/router.js

import express from 'express';
import {
    gethistoryCustomer,
    searchCustomers,
    updateCustomer,
    historyCustomer,
    getAllCustomers,
    makeNewRecord,
    deleteCustomer
} from '../controllers/customers.js';

import {
    loginCustomer, 
    logoutCustomer, 
    registerCustomer, 
    fetchCurrentUser 
} from '../controllers/sign.js';

import {
    addCustomField, 
    addCustomValues
} from '../controllers/custom.js';

import { uploadCustomerData } from '../controllers/uploadFile.js';
import { authenticateToken } from '../middlewares/auth.js';
import { makeAdminByUsername } from '../controllers/admin.js';
import { adminMiddleware } from '../middlewares/adminMiddleware.js';

import { checkCustomerByPhone } from '../controllers/newnum.js';

import {
    scheduleCall,  
    getAllScheduledCalls, 
    updateScheduledCall,
    // deleteScheduledCall
} from '../controllers/schedule.js';

const router = express.Router();

// Route for user registration
router.post('/register', registerCustomer);

// Route for user login
router.post('/login', loginCustomer);

// Route for user logout
router.post('/logout', authenticateToken, logoutCustomer);

// Route to get latest 5 customers
router.get('/customers', getAllCustomers);

// Route to search customers
router.get('/customers/search', searchCustomers);

// // Route to view customer details
// router.get('/customer/details/C_unique_id', viewCustomer);

// Route to check if customer exists by phone number
router.get('/customers/phone/:phone_no_primary', checkCustomerByPhone);

// Route to update a customer by ID
router.put('/customers/:id', updateCustomer);

// Route to post the updated history
router.post('/customers/log-change', historyCustomer);

// Route to see the updated history
router.get('/customers/log-change/:id', gethistoryCustomer);

// Route to create a new customer record
router.post('/customer/new', makeNewRecord);

// Route to create a new customer record with a new number 
router.post('/customer/new/:phone_no_primary', makeNewRecord);

// Route to delete a custom field
router.delete('/customer/:id', authenticateToken, deleteCustomer);

// Route to add a custom field
router.post('/customers/custom-fields', authenticateToken, addCustomField);

// Route to add custom values
router.post('/customer/custom-values/:id', addCustomValues);

// Route for uploading customer data
router.post('/upload-customer-data', uploadCustomerData);  // New route for uploading customer data

// Route to fetch current user
router.get('/current-user', authenticateToken, fetchCurrentUser);

// Route to get all scheduled calls
router.get('/customer/schedule-all-calls', getAllScheduledCalls);

// Route to schedule a call
router.post('/customer/schedule-call/:phone_no_primary', scheduleCall);

// Route to update a scheduled call
router.put('/customer/schedule-call/:phone_no_primary', updateScheduledCall);

// // Route to delete a scheduled call
// router.delete('/customer/delete-call/:id', deleteScheduledCall);

// Route for giving admin access
router.post('/promote-admin', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: "Username is required." });
    }

    const result = await makeAdminByUsername(username);
    return res.status(result.success ? 200 : 400).json(result);
});

export default router;
