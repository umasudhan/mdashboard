module.exports = function(RED) {
    var ui = require('../ui')(RED);

    function TemplateNode(config) {
        const socketIdVsHeaders = new Map();
        RED.nodes.createNode(this, config);
        var node = this;

        var group = RED.nodes.getNode(config.group);
        if (!group && config.templateScope !== 'global') { return; }
        var tab = null;
        if (config.templateScope !== 'global') {
            tab = RED.nodes.getNode(group.config.tab);
            if (!tab) { return; }
            if (!config.width) {
                config.width = group.config.width;
            }
        }
        var hei = Number(config.height|| 0);
        var previousTemplate = null
        var theme = ui.getTheme();
        var colortheme = {};
        for (var i in theme) {
            if (theme.hasOwnProperty(i)) {
                colortheme[i.replace(/-/g, "_")] = theme[i].value;
            }
        }

        var done = ui.add({
            forwardInputMessages: config.fwdInMessages,
            storeFrontEndInputAsState: config.storeOutMessages,
            emitOnlyNewValues: false,
            node: node,
            tab: tab,
            group: group,
            control: {
                type: 'template',
                order: config.order,
                width: config.width || 6,
                height: hei,
                format: config.format,
                templateScope: config.templateScope,
                theme: colortheme
            },
            beforeEmit: function(msg) {
                var properties = Object.getOwnPropertyNames(msg).filter(function (p) { return p[0] != '_'; });
                var clonedMsg = {
                    templateScope: config.templateScope
                };
                for (var i=0; i<properties.length; i++) {
                    var property = properties[i];
                    clonedMsg[property] = msg[property];
                }

                // transform to string if msg.template is buffer
                if (clonedMsg.template !== undefined && Buffer.isBuffer(clonedMsg.template)) {
                    clonedMsg.template = clonedMsg.template.toString();
                }

                if (clonedMsg.template === undefined && previousTemplate !== null) {
                    clonedMsg.template = previousTemplate;
                }

                //This updates the whole page if the template input changes and
                //height set to auto - performance killer, but here just in case
                // if ((config.height == "0") && (value !== node.oldvalue)) {
                //     node.oldvalue = value;
                //     setImmediate(function() { ui.updateUi(); });
                // }

                if (clonedMsg.template) {
                    previousTemplate = clonedMsg.template
                }

                return { msg:clonedMsg };
            },
            beforeSend: function (msg, original) {
                if (original) {
                    const headers = socketIdVsHeaders.get(original.socketid);
                    if (original.socketid) {
                        original.msg.socketid = original.socketid;
                    }
                    if (headers) {
                        original.msg.headers = headers;
                    }
                    return original.msg;
                }
            }
        });
        node.on("close", done);

        var sendconnect = function(socketid, socketip, headers, queryParams) {
            if (socketid && headers) {
                socketIdVsHeaders.set(socketid, headers);
            }
            node.send({
                session:{
                    state: "connect"
                },
                socketid,
                socketip,
                headers
            });
        };
        ui.ev.on('newsocket', sendconnect);

        var sendlost = function(socketid, socketip, headers, queryParams) {
            if (socketid) {
                socketIdVsHeaders.delete(socketid);
            }
            node.send({
                session:{
                    state: "disconnect"
                },
                socketid,
                socketip,
                headers
            });
        };
        ui.ev.on('endsocket', sendlost);

        this.on('close', function() {
            ui.ev.removeListener('newsocket', sendconnect);
            ui.ev.removeListener('endsocket', sendlost);
        })

    }
    RED.nodes.registerType("mui_template", TemplateNode);
    RED.library.register("uitemplates");
};
