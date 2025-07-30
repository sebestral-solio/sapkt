using { sap.capire.leave as my } from '../db/schema';

/**
 * Service used by employees to manage their leave requests.
 */
service EmployeeService {
  entity LeaveRequests as projection on my.LeaveRequests;
  @readonly
  entity Employees as projection on my.Employees;
  
  // Action to get current user info including roles
  action userInfo() returns {
    id: String;
    roles: array of String;
    isManager: Boolean;
    isAdmin: Boolean;
    isEmployee: Boolean;
  };
}
annotate EmployeeService with @(requires: 'employee');

/**
 * Service used by managers/admins to monitor and approve leaves.
 */
service AdminService {
  entity Employees as projection on my.Employees;
  entity LeaveRequests as projection on my.LeaveRequests;
}
annotate AdminService with @(requires: 'admin');
