var config = require(process.env.CONFIG);
var nmap = require('libnmap');
var send = require('gmail-send')({
    user: config.notifications.gmail.username,
    pass: config.notifications.gmail.password,
    to:   config.notifications.gmail.to
});


var doScan = (function(configuration) {
    var hosts = configuration.checks.hosts;

    function reportOfflineServices(offlineServices, hostName) {
        var subject = '[Health] Services arr\u00eat\u00e9s sur ' + hostName;
        var content;
        if (offlineServices.length === 1) {
            content = "Le service '" + offlineServices[0].name + "' sur le port " + offlineServices[0].port + " est arr&ecirc;t&eacute;"
        } else {
            content = "Les services suivants sont arr&ecirc;t&eacute;s :<br/><ul>";
            offlineServices.forEach(function (offlineService) {
                content += "<li>" + offlineService.name + " sur le port " + offlineService.port + "</li>"
            });
        }
        send({
            subject: subject,
            html: content
        }, function (err, res) {
            console.log('send(): err:', err, '; res:', res);
        });
    }

    function checkAllServicesForHost(host) {
        var options = {
            range: [
                host.address
            ],
            ports: '1-10000',
            json: true
        };
        var foundServices = [];
        nmap.scan(options, function(err, report) {
            if (err) throw new Error(err);

            for (var item in report) {
                if (report.hasOwnProperty(item)) {
                    var services = report[item].host[0].ports[0].port;
                    services.forEach(function (service) {
                        foundServices.push(service.item.portid);
                    });
                }
            }
            var offlineServices = host.services.filter(function (service) {
                for (var i = 0; i < foundServices.length; i++) {
                    if (service.port === foundServices[i]) {
                        return false;
                    }
                }
                return true;
            });
            if (offlineServices.length > 0) {
                reportOfflineServices(offlineServices, host.address);
            }
        });
    }

    return function () {
        hosts.forEach(function (host) {
            checkAllServicesForHost(host);
        });
    };
})(config);

doScan();
