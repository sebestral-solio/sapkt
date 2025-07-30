sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (Controller, Filter, FilterOperator, JSONModel, MessageToast, MessageBox) => {
    "use strict";

    return Controller.extend("leaveui.controller.EmployeeRequest", {
        onInit() {
            // Initialize a model to track UI state
            const oViewModel = new JSONModel({
                selectedIndex: -1,
                selectedRequest: null,
                busy: false,
                currentUser: null,
                isManager: false // Add isManager property initialization
            });
            this.getView().setModel(oViewModel, "requestsTable");
            
            // Load leave requests on initialization
            this.onRead();
            
            // Get current user info
            this._getCurrentUser();

            // Load AQI data
            this._loadAQIData();
        },
        
        /**
         * Format date values for display
         * @param {string} sDate - Date string in ISO format
         * @returns {string} Formatted date string
         */
        formatDate: function(sDate) {
            if (!sDate) return "";
            const oDate = new Date(sDate);
            return oDate.toLocaleDateString();
        },
        
        /**
         * Get current user information
         */
        _getCurrentUser: function() {
            // Set default user info until we get the actual data
            const userText = "Loading user info...";
            this.getView().byId("userInfoText").setText(userText);
            
            // Store user info in the view model
            const oViewModel = this.getView().getModel("requestsTable");
            
            // Call our new userInfo endpoint to get role information
            $.ajax({
                url: "/odata/v4/employee/userInfo",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({}), // Empty payload for the action
                success: (data) => {
                    console.log("User info from userInfo endpoint:", data);
                    
                    if (data) {
                        // Update the user info text
                        let displayRole = data.id;
                        if (data.isManager) displayRole = "manager";
                        else if (data.isAdmin) displayRole = "admin";
                        else if (data.isEmployee) displayRole = "employee";
                        
                        this.getView().byId("userInfoText").setText("Logged in as: " + displayRole);
                        
                        // Update the view model with user info
                        oViewModel.setProperty("/currentUser", {
                            id: data.id,
                            roles: data.roles || []
                        });
                        
                        // Set isManager flag for UI controls - check both role array and isManager flag
                        const hasManagerRole = data.roles && data.roles.includes('manager');
                        const isManagerFlag = data.isManager || false;
                        oViewModel.setProperty("/isManager", hasManagerRole || isManagerFlag);
                        
                        // Debug log
                        console.log("View model updated with user info:", {
                            currentUser: oViewModel.getProperty("/currentUser"),
                            isManager: oViewModel.getProperty("/isManager"),
                            hasManagerRole: hasManagerRole,
                            isManagerFlag: isManagerFlag
                        });
                    }
                },
                error: (err) => {
                    console.error("Failed to get user info:", err);
                    
                    // Fallback to default user info
                    this.getView().byId("userInfoText").setText("Logged in as: employee");
                    oViewModel.setProperty("/currentUser", { id: "employee", roles: ["employee"] });
                    oViewModel.setProperty("/isManager", false);
                    
                    // For testing only - URL parameter override
                    const urlParams = new URLSearchParams(window.location.search);
                    const role = urlParams.get('role');
                    
                    if (role === 'manager') {
                        this.getView().byId("userInfoText").setText("Logged in as: manager");
                        oViewModel.setProperty("/currentUser", { id: "manager", roles: ["manager", "employee"] });
                        oViewModel.setProperty("/isManager", true);
                    }
                }
            });
        },

        onRead: function () {
            // Set busy state
            const oViewModel = this.getView().getModel("requestsTable");
            oViewModel.setProperty("/busy", true);
            
            // Refresh the OData model to fetch the latest data
            const oModel = this.getView().getModel();
            if (oModel) {
                // Use refresh() without parameters to avoid bForceUpdate error
                oModel.refresh();
            }
            
            // Reset selection
            oViewModel.setProperty("/selectedIndex", -1);
            oViewModel.setProperty("/selectedRequest", null);
            oViewModel.setProperty("/busy", false);
            
            MessageToast.show("Leave requests refreshed");
        }, 
        
        /**
         * Open the create leave request dialog
         */
        onOpenCreateDialog: function() {
            // Set default dates
            const today = new Date();
            this.getView().byId("startDatePicker").setValue(this._formatDateForPicker(today));
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            this.getView().byId("endDatePicker").setValue(this._formatDateForPicker(tomorrow));
            
            // Clear other fields
            this.getView().byId("leaveTypeComboBox").setSelectedKey("AL");
            this.getView().byId("reasonTextArea").setValue("");
            
            // Open dialog
            this.getView().byId("createLeaveDialog").open();
        },
        
        /**
         * Create a new leave request
         */
        onCreateLeaveRequest: function() {
            // Validate form
            const startDate = this.getView().byId("startDatePicker").getValue();
            const endDate = this.getView().byId("endDatePicker").getValue();
            const leaveType = this.getView().byId("leaveTypeComboBox").getSelectedKey();
            const reason = this.getView().byId("reasonTextArea").getValue();
            
            if (!startDate || !endDate || !leaveType || !reason) {
                MessageBox.error("Please fill in all required fields");
                return;
            }
            
            // Create payload
            const payload = {
                // ID will be generated by the service
                startDate: startDate,
                endDate: endDate,
                reason: reason,
                status_code: "P", // Pending
                type_code: leaveType
            };
            
            console.log('Creating leave request:', payload);
            
            // Set busy state
            const oViewModel = this.getView().getModel("requestsTable");
            oViewModel.setProperty("/busy", true);
            
            // Send request
            $.ajax({
                url: "/odata/v4/employee/LeaveRequests",
                contentType: "application/json",
                type: "POST",
                data: JSON.stringify(payload),
                success: (data) => {
                    console.log("Created leave request:", data);
                    MessageToast.show("Leave request created successfully");
                    this.onCloseDialog();
                    this.onRead(); // Refresh the table
                },
                error: (err) => {
                    console.error("Error creating leave request:", err);
                    MessageBox.error("Failed to create leave request: " + (err.responseText || err.statusText));
                    oViewModel.setProperty("/busy", false);
                }
            });
        }, 
        /**
         * Open dialog to update a leave request
         */
        onOpenUpdateDialog: function() {
            const oViewModel = this.getView().getModel("requestsTable");
            const selectedRequest = oViewModel.getProperty("/selectedRequest");
            
            if (!selectedRequest) {
                MessageBox.error("Please select a leave request to update");
                return;
            }
            
            // Populate dialog with selected request data
            this.getView().byId("updateRequestId").setText(selectedRequest.ID);
            this.getView().byId("updateStartDatePicker").setValue(selectedRequest.startDate);
            this.getView().byId("updateEndDatePicker").setValue(selectedRequest.endDate);
            this.getView().byId("updateLeaveTypeComboBox").setSelectedKey(selectedRequest.type_code);
            this.getView().byId("updateReasonTextArea").setValue(selectedRequest.reason);
            
            // Open dialog
            this.getView().byId("updateLeaveDialog").open();
        },
        
        /**
         * Update a leave request
         */
        onUpdateLeaveRequest: function() {
            const oViewModel = this.getView().getModel("requestsTable");
            const selectedRequest = oViewModel.getProperty("/selectedRequest");
            
            if (!selectedRequest) {
                MessageBox.error("No leave request selected");
                return;
            }
            
            // Get updated values
            const startDate = this.getView().byId("updateStartDatePicker").getValue();
            const endDate = this.getView().byId("updateEndDatePicker").getValue();
            const leaveType = this.getView().byId("updateLeaveTypeComboBox").getSelectedKey();
            const reason = this.getView().byId("updateReasonTextArea").getValue();
            
            if (!startDate || !endDate || !leaveType || !reason) {
                MessageBox.error("Please fill in all required fields");
                return;
            }
            
            // Create payload
            const payload = {
                ID: selectedRequest.ID,
                employee_ID: selectedRequest.employee_ID, // Preserve employee_ID
                startDate: startDate,
                endDate: endDate,
                reason: reason,
                status_code: selectedRequest.status_code,
                type_code: leaveType
            };
            
            console.log('Updating leave request:', payload);
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Send request
            $.ajax({
                url: `/odata/v4/employee/LeaveRequests('${selectedRequest.ID}')`,
                contentType: "application/json",
                type: "PUT",
                data: JSON.stringify(payload),
                success: (data) => {
                    console.log("Updated leave request:", data);
                    MessageToast.show("Leave request updated successfully");
                    this.onCloseDialog();
                    this.onRead(); // Refresh the table
                },
                error: (err) => {
                    console.error("Error updating leave request:", err);
                    MessageBox.error("Failed to update leave request: " + (err.responseText || err.statusText));
                    oViewModel.setProperty("/busy", false);
                }
            });
        },
        /**
         * Show delete confirmation dialog
         */
        onDeleteConfirm: function() {
            const oViewModel = this.getView().getModel("requestsTable");
            const selectedRequest = oViewModel.getProperty("/selectedRequest");
            
            if (!selectedRequest) {
                MessageBox.error("Please select a leave request to delete");
                return;
            }
            
            this.getView().byId("deleteConfirmDialog").open();
        },
        
        /**
         * Delete a leave request
         */
        onDelete: function() {
            const oViewModel = this.getView().getModel("requestsTable");
            const selectedRequest = oViewModel.getProperty("/selectedRequest");
            
            if (!selectedRequest) {
                MessageBox.error("No leave request selected");
                return;
            }
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Close dialog
            this.onCloseDialog();
            
            // Send delete request
            $.ajax({
                url: `/odata/v4/employee/LeaveRequests('${selectedRequest.ID}')`,
                contentType: "application/json",
                type: "DELETE",
                success: (data) => {
                    console.log("Deleted leave request:", selectedRequest.ID);
                    MessageToast.show("Leave request deleted successfully");
                    this.onRead(); // Refresh the table
                },
                error: (err) => {
                    console.error("Error deleting leave request:", err);
                    MessageBox.error("Failed to delete leave request: " + (err.responseText || err.statusText));
                    oViewModel.setProperty("/busy", false);
                }
            });
        },
        
        /**
         * Handler for the search button on the filter bar
         * @param {sap.ui.base.Event} oEvent The search event
         */
        /**
         * Handle selection change in the table
         */
        onSelectionChange: function(oEvent) {
            const oViewModel = this.getView().getModel("requestsTable");
            const oTable = this.getView().byId("requestsTable");
            const oSelectedItem = oEvent.getParameter("listItem");
            
            if (oSelectedItem) {
                const oContext = oSelectedItem.getBindingContext();
                const oSelectedRequest = oContext.getObject();
                const iIndex = oTable.indexOfItem(oSelectedItem);
                
                oViewModel.setProperty("/selectedIndex", iIndex);
                oViewModel.setProperty("/selectedRequest", oSelectedRequest);
                console.log("Selected request:", oSelectedRequest);
            } else {
                oViewModel.setProperty("/selectedIndex", -1);
                oViewModel.setProperty("/selectedRequest", null);
            }
        },
        
        /**
         * Close all dialogs
         */
        onCloseDialog: function() {
            this.getView().byId("createLeaveDialog").close();
            this.getView().byId("updateLeaveDialog").close();
            this.getView().byId("deleteConfirmDialog").close();
            this.getView().byId("statusUpdateDialog").close();
        },
        
        /**
         * Open status update dialog for managers
         */
        onOpenStatusUpdateDialog: function() {
            const oViewModel = this.getView().getModel("requestsTable");
            const selectedRequest = oViewModel.getProperty("/selectedRequest");
            
            if (!selectedRequest) {
                MessageBox.error("Please select a leave request to update");
                return;
            }
            
            // Only allow updating pending requests
            if (selectedRequest.status_code !== 'P') {
                MessageBox.error("Only pending requests can be approved or rejected");
                return;
            }
            
            // Populate the dialog with the selected request data
            this.getView().byId("statusEmployeeId").setText(selectedRequest.employee_ID);
            this.getView().byId("statusStartDate").setText(this.formatDate(selectedRequest.startDate));
            this.getView().byId("statusEndDate").setText(this.formatDate(selectedRequest.endDate));
            this.getView().byId("statusReason").setText(selectedRequest.reason);
            
            // Format leave type
            let leaveTypeText = "Unknown";
            if (selectedRequest.type_code === 'AL') leaveTypeText = "Annual Leave";
            else if (selectedRequest.type_code === 'SL') leaveTypeText = "Sick Leave";
            else if (selectedRequest.type_code === 'CL') leaveTypeText = "Casual Leave";
            this.getView().byId("statusLeaveType").setText(leaveTypeText);
            
            // Format current status
            let statusText = "Unknown";
            if (selectedRequest.status_code === 'P') statusText = "Pending";
            else if (selectedRequest.status_code === 'A') statusText = "Approved";
            else if (selectedRequest.status_code === 'R') statusText = "Rejected";
            else if (selectedRequest.status_code === 'C') statusText = "Cancelled";
            this.getView().byId("statusCurrentStatus").setText(statusText);
            
            // Reset the status selection
            this.getView().byId("statusComboBoxUpdate").setSelectedKey("");
            
            // Open dialog
            this.getView().byId("statusUpdateDialog").open();
        },
        
        /**
         * Update the status of a leave request (manager only)
         */
        onUpdateStatus: function() {
            const oViewModel = this.getView().getModel("requestsTable");
            const selectedRequest = oViewModel.getProperty("/selectedRequest");
            
            if (!selectedRequest) {
                MessageBox.error("No leave request selected");
                return;
            }
            
            // Get the new status
            const newStatus = this.getView().byId("statusComboBoxUpdate").getSelectedKey();
            
            if (!newStatus) {
                MessageBox.error("Please select a status");
                return;
            }
            
            // Create payload with only the status change
            const payload = {
                status_code: newStatus
            };
            
            console.log('Updating leave request status:', payload);
            
            // Set busy state
            oViewModel.setProperty("/busy", true);
            
            // Send request
            $.ajax({
                url: `/odata/v4/employee/LeaveRequests('${selectedRequest.ID}')`,
                contentType: "application/json",
                type: "PATCH", // Use PATCH to update only specific fields
                data: JSON.stringify(payload),
                success: (data) => {
                    console.log("Updated leave request status:", newStatus);
                    const statusText = newStatus === 'A' ? 'approved' : 'rejected';
                    MessageToast.show(`Leave request ${statusText} successfully`);
                    this.onCloseDialog();
                    this.onRead(); // Refresh the table
                },
                error: (err) => {
                    console.error("Error updating leave request status:", err);
                    MessageBox.error("Failed to update status: " + (err.responseText || err.statusText));
                    oViewModel.setProperty("/busy", false);
                }
            });
        },
        
        /**
         * Format date for date picker
         * @private
         */
        _formatDateForPicker: function(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        
        onSearch: function(oEvent) {
            // Get the filter bar and its filter items
            const oFilterBar = this.getView().byId("filterbar");
            const oTable = this.getView().byId("requestsTable");
            const oBinding = oTable.getBinding("items");
            const aFilters = [];
            
            // Get filter values
            const sEmployeeId = this.getView().byId("employeeIdInput").getValue();
            const sStatus = this.getView().byId("statusComboBox").getSelectedKey();
            const oDateRange = this.getView().byId("dateRangeSelection");
            const oStartDate = oDateRange.getDateValue();
            const oEndDate = oDateRange.getSecondDateValue();
            
            // Create filters based on user input
            if (sEmployeeId) {
                aFilters.push(new Filter("employee_ID", FilterOperator.EQ, sEmployeeId));
            }
            
            if (sStatus) {
                aFilters.push(new Filter("status_code", FilterOperator.EQ, sStatus));
            }
            
            if (oStartDate && oEndDate) {
                // Format dates to ISO string for OData compatibility
                const startDateISO = oStartDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                const endDateISO = oEndDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                aFilters.push(new Filter("startDate", FilterOperator.BT, startDateISO, endDateISO));
            }
            
            // Apply filters to the table binding
            oBinding.filter(aFilters);
            
            MessageToast.show("Filters applied");
        },
        
        /**
         * Handler for the reset button on the filter bar
         * @param {sap.ui.base.Event} oEvent The reset event
         */
        onReset: function(oEvent) {
            // Reset all filter fields
            this.getView().byId("employeeIdInput").setValue("");
            this.getView().byId("statusComboBox").setSelectedKey("");
            this.getView().byId("dateRangeSelection").setValue("");
            
            // Clear all filters
            const oTable = this.getView().byId("requestsTable");
            const oBinding = oTable.getBinding("items");
            oBinding.filter([]);
            
            MessageToast.show("Filters reset");
        },

        /**
         * Load Air Quality Index data
         * @private
         */
        _loadAQIData: function() {
            // Default location (you can make this configurable or get user's location)
            const defaultLocation = "Bengaluru"; // You can change this to any city
            this._fetchAQIData(defaultLocation);
        },

        /**
         * Fetch AQI data from WeatherAPI
         * @param {string} location - Location to get AQI data for
         * @private
         */
        _fetchAQIData: function(location) {
            // Use BTP destination to call WeatherAPI
            // The destination handles authentication (API key) automatically
            console.log("Fetching AQI data for location:", location);
            console.log("Using URL:", `/destinations/WeatherAPI_AQI/current.json?q=${location}&aqi=yes`);

            $.ajax({
                url: `/destinations/WeatherAPI_AQI/current.json?q=${location}&aqi=yes`,
                type: "GET",
                success: (data) => {
                    console.log("AQI data received:", data);
                    this._updateAQIDisplay(data);
                },
                error: (xhr, status, error) => {
                    console.error("Failed to fetch AQI data:");
                    console.error("Status:", status);
                    console.error("Error:", error);
                    console.error("Response:", xhr.responseText);
                    console.error("Status Code:", xhr.status);
                    this._showAQIError();
                }
            });
        },

        /**
         * Update the AQI display with fetched data
         * @param {object} data - Weather API response data
         * @private
         */
        _updateAQIDisplay: function(data) {
            if (!data || !data.current || !data.current.air_quality) {
                this._showAQIError();
                return;
            }

            const location = data.location;
            const airQuality = data.current.air_quality;
            const current = data.current;

            // Update location
            this.getView().byId("aqiLocationText").setText(`${location.name}, ${location.country}`);

            // Update main AQI value (using US EPA index)
            const aqiValue = airQuality["us-epa-index"] || 0;
            const aqiStatus = this._getAQIStatus(aqiValue);

            this.getView().byId("aqiValueText").setText(`AQI: ${aqiValue} - ${aqiStatus.text}`);
            this.getView().byId("aqiStatusText").setText(aqiStatus.description);

            // Set color based on AQI level
            const aqiText = this.getView().byId("aqiValueText");
            aqiText.removeStyleClass("aqiGood aqiModerate aqiUnhealthy aqiVeryUnhealthy aqiHazardous");
            aqiText.addStyleClass(aqiStatus.styleClass);

            // Update last updated time
            this.getView().byId("aqiLastUpdated").setText(`Updated: ${current.last_updated}`);

            // Update detailed pollutant data
            this.getView().byId("pm25Text").setText(`${Math.round(airQuality.pm2_5 || 0)} μg/m³`);
            this.getView().byId("pm10Text").setText(`${Math.round(airQuality.pm10 || 0)} μg/m³`);
            this.getView().byId("coText").setText(`${Math.round(airQuality.co || 0)} μg/m³`);
            this.getView().byId("no2Text").setText(`${Math.round(airQuality.no2 || 0)} μg/m³`);
            this.getView().byId("o3Text").setText(`${Math.round(airQuality.o3 || 0)} μg/m³`);
            this.getView().byId("so2Text").setText(`${Math.round(airQuality.so2 || 0)} μg/m³`);
        },

        /**
         * Get AQI status information based on EPA index
         * @param {number} aqiValue - AQI value (1-6 scale)
         * @returns {object} Status information
         * @private
         */
        _getAQIStatus: function(aqiValue) {
            switch(aqiValue) {
                case 1:
                    return {
                        text: "Good",
                        description: "Air quality is satisfactory",
                        styleClass: "aqiGood"
                    };
                case 2:
                    return {
                        text: "Moderate",
                        description: "Air quality is acceptable",
                        styleClass: "aqiModerate"
                    };
                case 3:
                    return {
                        text: "Unhealthy for Sensitive Groups",
                        description: "Sensitive individuals may experience problems",
                        styleClass: "aqiUnhealthy"
                    };
                case 4:
                    return {
                        text: "Unhealthy",
                        description: "Everyone may experience health effects",
                        styleClass: "aqiUnhealthy"
                    };
                case 5:
                    return {
                        text: "Very Unhealthy",
                        description: "Health alert: everyone may experience serious effects",
                        styleClass: "aqiVeryUnhealthy"
                    };
                case 6:
                    return {
                        text: "Hazardous",
                        description: "Emergency conditions: entire population affected",
                        styleClass: "aqiHazardous"
                    };
                default:
                    return {
                        text: "Unknown",
                        description: "AQI data unavailable",
                        styleClass: ""
                    };
            }
        },

        /**
         * Show AQI error state
         * @private
         */
        _showAQIError: function() {
            this.getView().byId("aqiLocationText").setText("Location unavailable");
            this.getView().byId("aqiValueText").setText("AQI data unavailable");
            this.getView().byId("aqiStatusText").setText("Unable to fetch air quality data");
            this.getView().byId("aqiLastUpdated").setText("");

            // Clear detailed data
            this.getView().byId("pm25Text").setText("-");
            this.getView().byId("pm10Text").setText("-");
            this.getView().byId("coText").setText("-");
            this.getView().byId("no2Text").setText("-");
            this.getView().byId("o3Text").setText("-");
            this.getView().byId("so2Text").setText("-");
        },



        /**
         * Refresh AQI data button handler
         */
        onRefreshAQI: function() {
            this._loadAQIData();
            MessageToast.show("Refreshing air quality data...");
        }
    });
});
