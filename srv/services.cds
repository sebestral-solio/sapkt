using { sap.capire.leave as my } from '../db/schema';

/**
 * Service used by employees to manage their leave requests.
 */
service EmployeeService {
  entity LeaveRequests as projection on my.LeaveRequests;
  @readonly
  entity Employees as projection on my.Employees;
}

/**
 * Service used by managers/admins to monitor and approve leaves.
 */
service AdminService {
  entity Employees as projection on my.Employees;
  entity LeaveRequests as projection on my.LeaveRequests;
}
