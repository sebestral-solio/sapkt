using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';
namespace sap.capire.leave;

/**
 * Leave Requests raised by Employees
 */
entity LeaveRequests :  managed {
  key ID       : String(20);
  employee     : Association to Employees;
  startDate    : Date;
  endDate      : Date;
  reason       : String;
  status       : Association to LeaveStatus default 'P';
  type         : Association to LeaveType default 'AL';
  comments     : Composition of many {
    key ID      : UUID;
    timestamp   : type of managed:createdAt;
    author      : type of managed:createdBy;
    message     : String;
  };
}

/**
 * Employees in the system
 */
entity Employees : managed {
  key ID        : String;
  firstName     : String;
  lastName      : String;
  name          : String = firstName || ' ' || lastName;
  email         : EMailAddress;
  phone         : PhoneNumber;
  leaveRequests : Association to many LeaveRequests on leaveRequests.employee = $self;
  addresses     : Composition of many Addresses on addresses.employee = $self;
}

/**
 * Address of employee
 */
entity Addresses : cuid, managed {
  employee      : Association to Employees;
  city          : String;
  postCode      : String;
  streetAddress : String;
}

/**
 * Leave status (enum)
 */
entity LeaveStatus : CodeList {
  key code: String enum {
    pending = 'P';
    approved = 'A';
    rejected = 'R';
    cancelled = 'C';
  };
  descr       : String;
  criticality : Integer;
}

/**
 * Leave type (enum)
 */
entity LeaveType : CodeList {
  key code: String enum {
    annual = 'AL';
    sick = 'SL';
    casual = 'CL';
  };
  descr : String;
}

type EMailAddress : String;
type PhoneNumber : String;

