const jwt = require('jsonwebtoken');
require('dotenv').config();

// Generate a new admin token
const adminId = process.env.ADMIN_ID || '68de4d025b15560d3e7fe855'; // The admin ID from the database
const adminEmail = process.env.ADMIN_EMAIL || 'admin@tripme.com';
const adminName = process.env.ADMIN_NAME || 'Admin';

const token = jwt.sign(
  {
    id: adminId,
    email: adminEmail,
    role: 'admin',
    name: adminName
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('Generated admin token:');
console.log(token);
console.log('\nTest the token:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:5001/api/admin/users`);
