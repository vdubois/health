var config = require(process.env.CONFIG);
var nmap = require('libnmap');
var send = require('gmail-send')({
    user: config.notifications.gmail.username,
    pass: config.notifications.gmail.password,
    to:   config.notifications.gmail.to
});
var request = require('request');

var doScan = (function(configuration) {
    var hosts = configuration.checks.hosts;

    /**
     * Report on unexpected state
     * @param offlineServices array of offline services
     * @param hostName name of host with offline services
     */
    function reportOfflineServices(offlineServices, hostName) {
        reportByMail(offlineServices, [], hostName);
        reportByHttp(offlineServices, [], hostName);
    }

    /**
     * Report on unexpected state
     * @param offlineServices array of offline services
     * @param hostName name of host with offline services
     */
    function reportOfflineHost(hostName) {
        reportByMail([], [], hostName);
        reportByHttp([], [], hostName);
    }

    function reportOfflineEndpoints(endpoints, hostName) {
        reportByMail([], endpoints, hostName);
        reportByHttp([], endpoints, hostName);
    }

    function reportByHttp(offlineServices, offlineEndpoints, hostName) {
        if (config.notifications.http && config.notifications.http.url) {
            if (offlineServices.length >= 1 || offlineEndpoints.length >= 1) {
                var content = '[Health] Services arretes sur ' + hostName;
            } else {
                var content = '[Health] Serveur ' + hostName + ' arrete';
            }
            if (offlineServices.length === 1) {
                content += " : Le service '" + offlineServices[0].name + "' sur le port " + offlineServices[0].port;
            } else if (offlineEndpoints.length === 1) {
                    content += " : Le service '" + offlineEndpoints[0].name;
            } else if (offlineServices.length > 1) {
                content += " : Les services ";
                offlineServices.forEach(function (offlineService, index) {
                    content += offlineService.name + " sur le port " + offlineService.port + (index < offlineServices.length - 1 ? "," : ":")
                });
            } else if (offlineEndpoints.length > 1) {
                content += " : Les services ";
                offlineEndpoints.forEach(function (offlineEndpoint, index) {
                    content += offlineEndpoint.name + (index < offlineServices.length - 1 ? "," : ":")
                });
            }
            var reportURL = config.notifications.http.url.replace(/\{content\}/, content);
            request(reportURL, function (error, response, body) {
                console.log(body);
            });
        }
    }

    function reportByMail(offlineServices, offlineEndpoints, hostName) {
        if (config.notifications.gmail) {
            if (offlineServices.length >= 1 || offlineEndpoints.length >= 1) {
                var subject = '[Health] Services arr\u00eat\u00e9s sur ' + hostName;
            } else {
                var subject = '[Health] Serveur ' + hostName + ' arr\u00eat\u00e9';
            }
            var content;
            if (offlineServices.length === 1) {
                content = "Le service '" + offlineServices[0].name + "' sur le port " + offlineServices[0].port + " est arr&ecirc;t&eacute;"
            } else if (offlineEndpoints.length === 1) {
                    content = "Le service '" + offlineEndpoints[0].name + "' est arr&ecirc;t&eacute;"
            } else if (offlineServices.length > 1) {
                content = "Les services suivants sont arr&ecirc;t&eacute;s :<br/><ul>";
                offlineServices.forEach(function (offlineService) {
                    content += "<li>" + offlineService.name + " sur le port " + offlineService.port + "</li>"
                });
            } else if (offlineEndpoints.length > 1) {
                content = "Les services suivants sont arr&ecirc;t&eacute;s :<br/><ul>";
                offlineEndpoints.forEach(function (offlineEndpoint) {
                    content += "<li>" + offlineEndpoint.name + "</li>"
                });
            }
            send({
                subject: subject,
                html: content
            }, function (err, res) {
                console.log('send(): err:', err, '; res:', res);
            });
        }
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
            if (err) {
                reportOfflineHost(host.address);
            } else {
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
            }
        });
    }

    function checkAllEndpointsForHost(host) {
        var foundEndpoints = [];

        if (host.endpoints) {
            host.endpoints.forEach(function (endpoint) {
                request.getS(endpoint.url, function (error, response, body) {
                    if (!error && response.statusCode == 200 && JSON.parse(body)[endpoint.contains]) {
                    } else {
                        foundEndpoints.push(endpoint);
                        reportOfflineEndpoints(foundEndpoints, host.address);
                    }
                });
            });
        }
    }

    return function () {
        hosts.forEach(function (host) {
            checkAllServicesForHost(host);
            checkAllEndpointsForHost(host);
        });
    };
})(config);

doScan();
