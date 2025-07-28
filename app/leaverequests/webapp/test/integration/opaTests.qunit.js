sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'ns/leaverequests/test/integration/FirstJourney',
		'ns/leaverequests/test/integration/pages/LeaveRequestsList',
		'ns/leaverequests/test/integration/pages/LeaveRequestsObjectPage'
    ],
    function(JourneyRunner, opaJourney, LeaveRequestsList, LeaveRequestsObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('ns/leaverequests') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheLeaveRequestsList: LeaveRequestsList,
					onTheLeaveRequestsObjectPage: LeaveRequestsObjectPage
                }
            },
            opaJourney.run
        );
    }
);