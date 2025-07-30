const cds = require('@sap/cds');
const { SELECT } = cds.ql;

// Implement the services defined in services.cds
module.exports = async (srv) => {
  // Log when the service is initialized
  console.log('Service implementation loaded:', srv.name);
  
  const db = await cds.connect.to('db');
  console.log('Database connection established for', srv.name);
  
  // Add a user info endpoint to provide role information
  srv.on('userInfo', async (req) => {
    const user = req.user;
    console.log('User info requested:', user ? user.id : 'anonymous');
    
    // Create response with user ID and roles
    const userInfo = {
      id: user ? user.id : 'anonymous',
      roles: [],
      isManager: false,
      isAdmin: false,
      isEmployee: false
    };
    
    // Add roles if user is authenticated
    if (user) {
      // Add actual roles from the user object
      if (user.is('admin')) {
        userInfo.roles.push('admin');
        userInfo.isAdmin = true;
      }
      
      if (user.is('manager')) {
        userInfo.roles.push('manager');
        userInfo.isManager = true;
      }
      
      if (user.is('employee')) {
        userInfo.roles.push('employee');
        userInfo.isEmployee = true;
      }
      
      // Special handling for manager user - ensure manager role is detected
      if (user.id === 'manager' || user.is('manager')) {
        if (!userInfo.roles.includes('manager')) {
          userInfo.roles.push('manager');
        }
        userInfo.isManager = true;
        console.log('Manager user detected');
      }
    }
    
    console.log('Returning user info:', userInfo);
    return userInfo;
  });
  
  // Add BEFORE CREATE handler to automatically set the employee_ID
  srv.before('CREATE', 'LeaveRequests', async (req) => {
    console.log('CREATE LeaveRequests event triggered');
    const user = req.user;
    
    // Debug request data
    console.log('Request data:', JSON.stringify(req.data));
    
    if (user) {
      // Get the employee ID for the current user using the same logic as in READ
      let employeeId;
      
      try {
        if (user.is('admin') && !user.is('employee')) {
          console.log('Admin user creating request');
          // For admin, we might want to keep the employee_ID as provided
          // or set a default if none was provided
          if (!req.data.employee_ID) {
            req.data.employee_ID = 'A001'; // Default admin ID
          }
        } else {
          // For employee users, find their employee ID
          const Employees = srv.entities.Employees;
          const results = await SELECT.from(Employees)
            .where({ firstName: { like: `%${user.id}%` } })
            .limit(1);
            
          if (results.length > 0) {
            employeeId = results[0].ID;
            console.log(`Found employee ID ${employeeId} for user ${user.id}`);
          } else {
            console.log(`No employee found for user ${user.id}, using default mapping`);
            // Fallback mapping if no employee is found
            const fallbackMap = {
              'employee': 'E001',
              'manager': 'E002',
              'admin': 'A001'
            };
            employeeId = fallbackMap[user.id];
          }
          
          // Set the employee_ID in the request data
          req.data.employee_ID = employeeId;
          console.log(`Set employee_ID to ${employeeId} for the new leave request`);
        }
      } catch (error) {
        console.error('Error setting employee ID for create:', error);
        // Continue with the request even if there's an error
        // The employee_ID will remain as provided or null
      }
    }
  });
  
  // Add READ handler to filter leave requests based on user role and ID
  srv.on('READ', 'LeaveRequests', async (req, next) => {
    // Get the current user from the request
    const user = req.user;
    console.log('READ LeaveRequests event triggered');
    
    // Debug user information
    if (user) {
      console.log('Current user:', JSON.stringify({
        id: user.id,
        roles: user.roles
      }));
      
      // Get the employee ID from the database based on username
      // This assumes there's a mapping between user IDs and employee IDs
      // For this example, we'll use the username to find a matching employee
      // In a real system, you'd have a proper user-to-employee mapping table
      let employeeId;
      
      try {
        // For admin users, we don't need to look up an employee ID
        if (user.is('admin') && !user.is('employee')) {
          console.log('Admin user - no need to look up employee ID');
          employeeId = null;
        } else {
          // For employee users, try to find a matching employee
          // This is a simplified approach - in a real system, you'd have a proper mapping table
          // Here we're using the first part of the email (before @) to match with the username
          const Employees = srv.entities.Employees;
          const results = await SELECT.from(Employees)
            .where({ firstName: { like: `%${user.id}%` } })
            .limit(1);
            
          if (results.length > 0) {
            employeeId = results[0].ID;
            console.log(`Found employee ID ${employeeId} for user ${user.id}`);
          } else {
            console.log(`No employee found for user ${user.id}, using default mapping`);
            // Fallback mapping if no employee is found
            const fallbackMap = {
              'employee': 'E001',
              'manager': 'E002',
              'admin': 'A001'
            };
            employeeId = fallbackMap[user.id];
          }
        }
      } catch (error) {
        console.error('Error looking up employee ID:', error);
        // Default to no filtering if there's an error
        employeeId = null;
      }
      
      // If user has employee role but not admin role, filter by employee_ID
      if (user.is('employee') && !user.is('admin') && employeeId) {
        console.log(`Employee user ${employeeId} - filtering to show only their requests`);
        
        // Get all results first
        const results = await next();
        console.log('All results:', JSON.stringify(results));
        
        // Check if results is an array or a single object
        if (Array.isArray(results)) {
          // Filter the results to only include this employee's requests
          const filteredResults = results.filter(request => {
            console.log(`Comparing ${request.employee_ID} with ${employeeId}`);
            return request.employee_ID === employeeId;
          });
          
          console.log(`Filtered from ${results.length} to ${filteredResults.length} requests`);
          return filteredResults;
        } else if (results && typeof results === 'object') {
          // Handle single object case
          console.log(`Single result object with employee_ID: ${results.employee_ID}`);
          if (results.employee_ID === employeeId) {
            return results;
          } else {
            console.log('Single result filtered out due to employee_ID mismatch');
            return [];
          }
        } else {
          // Return empty result if neither array nor object
          console.log('No results or unexpected result type');
          return results || [];
        }
      } else if (user.is('admin')) {
        console.log('Admin user - showing all leave requests');
        return next(); // Continue with default handling
      }
    }
    
    return next(); // Default: continue with standard processing
  });

  // Before handler for CREATE on LeaveRequests
  srv.before('CREATE', 'LeaveRequests', async (req) => {
    console.log('CREATE LeaveRequests event triggered');
    console.log('Request data:', JSON.stringify(req.data));
    
    try {
      // Use CDS API to query the entity instead of direct SQL
      const LeaveRequests = srv.entities.LeaveRequests;
      const results = await SELECT.from(LeaveRequests)
                            .columns('ID')
                            .orderBy({ ref: ['ID'], sort: 'desc' })
                            .limit(1);
      
      // Generate the next ID
      let nextId = 1;
      if (results.length > 0 && results[0].ID) {
        // Extract numeric part from ID (e.g., "LVR_001" -> 1)
        const match = results[0].ID.match(/LVR_(\d+)/);
        if (match && match[1]) {
          nextId = parseInt(match[1], 10) + 1;
        }
      }
      
      console.log('Generated next ID number:', nextId);
      const padded = nextId.toString().padStart(3, '0'); // "001", "002", etc.
      req.data.ID = `LVR_${padded}`;
      console.log('Generated ID:', req.data.ID);
    } catch (error) {
      console.error('Error generating ID:', error);
      // Fallback to a timestamp-based ID if the query fails
      const timestamp = Date.now().toString().slice(-6);
      req.data.ID = `LVR_${timestamp}`;
      console.log('Fallback ID generated:', req.data.ID);
    }
  });

  // Add handler for UPDATE to track those requests too
  srv.before('UPDATE', 'LeaveRequests', async (req) => {
    console.log('UPDATE LeaveRequests event triggered');
    console.log('Request data:', JSON.stringify(req.data));
    console.log('Request parameters:', JSON.stringify(req.params));
  });
}
