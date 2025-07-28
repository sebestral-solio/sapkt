const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const db = await cds.connect.to('db');

  this.before('CREATE', 'LeaveRequests', async (req) => {
    const [{ NEXTVAL }] = await db.run(`SELECT "LVR_SEQ".NEXTVAL FROM DUMMY`);
    const padded = NEXTVAL.toString().padStart(3, '0'); // "001", "002", etc.
    req.data.ID = `LVR_${padded}`;
  });
});
