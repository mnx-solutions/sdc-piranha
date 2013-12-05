'use strict';

function syncLead(userId, object) {
    var xml = '<tns:paramsSyncLead>';
    xml += '<leadRecord><ForeignSysPersonId>' + userId + '</ForeignSysPersonId>';
    xml += '<leadAttributeList>';

    Object.keys(object).forEach(function (name) {
        if(object[name]) {
            xml += '<attribute><attrName>' + name + '</attrName><attrValue>' + object[name] + '</attrValue></attribute>';
        }
    });

    xml += '</leadAttributeList></leadRecord>';
    xml += '<returnLead>false</returnLead></tns:paramsSyncLead>';

    return xml;
}

module.exports.syncLead = syncLead;