import express from 'express';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../controller/holiday.controller.js';

const router = express.Router();

router.get('/', getHolidays);
router.post('/', createHoliday);
router.put('/:id', updateHoliday);
router.delete('/:id', deleteHoliday);

export default router;
