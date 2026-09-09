import { pool } from './config/db.js';
import { getCustomerBillingReport } from './controller/customer.controller.js';

async function test() {
  const req = {
    query: {
      month: '2026-09'
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log('Response status:', this.statusCode);
      console.log('Response JSON success:', data.success);
      if (!data.success) {
        console.error('Error message:', data.message);
      } else {
        console.log('Summary:', data.summary);
        console.log('Data length:', data.data?.length);
      }
    }
  };

  try {
    await getCustomerBillingReport(req, res);
  } catch (e) {
    console.error('Thrown error in controller:', e);
  } finally {
    await pool.end();
  }
}

test();
