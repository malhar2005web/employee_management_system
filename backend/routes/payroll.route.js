import express from 'express';
import { getMonthlyPayroll, updateEmployeeRates, exportPayrollCSV } from '../controller/payroll.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

router.use(protectRoute, isAdmin);

router.get('/monthly', getMonthlyPayroll);
router.put('/employee/:id/rates', updateEmployeeRates);
router.get('/export-csv', exportPayrollCSV);

export default router;
