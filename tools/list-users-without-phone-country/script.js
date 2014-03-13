'use strict';

var map = {"AFG": "93", "ALA": "358", "ALB": "355", "DZA": "213", "ASM": "1", "AND": "376", "AGO": "244", "AIA": "1", "ATG": "1", "ARG": "54", "ARM": "374", "ABW": "297", "AUS": "61", "AUT": "43", "AZE": "994", "BHS": "1", "BHR": "973", "BGD": "880", "BRB": "1", "BLR": "375", "BEL": "32", "BLZ": "501", "BEN": "229", "BMU": "1", "BTN": "975", "BOL": "591", "BIH": "387", "BWA": "267", "BRA": "55", "IOT": "246", "BRN": "673", "BGR": "359", "BFA": "226", "BDI": "257", "KHM": "855", "CMR": "237", "CAN": "1", "CPV": "238", "CYM": "1", "CAF": "236", "TCD": "235", "CHL": "56", "CHN": "86", "CXR": "57", "CCK": "61", "COL": "57", "COM": "269", "COG": "242", "COD": "243", "COK": "682", "CRI": "506", "CIV": "225", "HRV": "385", "CYP": "357", "CZE": "420", "DNK": "45", "DJI": "253", "DMA": "1", "DOM": "1", "ECU": "593", "EGY": "20", "SLV": "503", "GNQ": "240", "ERI": "291", "EST": "372", "ETH": "251", "FLK": "500", "FRO": "298", "FJI": "679", "FIN": "358", "FRA": "33", "GUF": "594", "PYF": "689", "GAB": "241", "GMB": "220", "GEO": "995", "DEU": "49", "GHA": "233", "GIB": "350", "GRC": "30", "GRL": "299", "GRD": "1", "GLP": "590", "GUM": "1", "GTM": "502", "GGY": "44", "GIN": "224", "GNB": "245", "GUY": "592", "HTI": "509", "VAT": "39", "HND": "504", "HKG": "852", "HUN": "36", "ISL": "354", "IND": "91", "IDN": "62", "IRQ": "964", "IRL": "353", "IMN": "44", "ISR": "972", "ITA": "39", "JAM": "1", "JPN": "81", "JEY": "44", "JOR": "962", "KAZ": "7", "KEN": "254", "KIR": "686", "KOR": "82", "KWT": "965", "KGZ": "996", "LAO": "856", "LVA": "371", "LBN": "961", "LSO": "266", "LBR": "231", "LBY": "218", "LIE": "423", "LTU": "370", "LUX": "352", "MAC": "853", "MKD": "389", "MDG": "261", "MWI": "265", "MYS": "60", "MDV": "960", "MLI": "223", "MLT": "356", "MHL": "692", "MTQ": "596", "MRT": "222", "MUS": "230", "MYT": "262", "MEX": "52", "FSM": "691", "MDA": "373", "MCO": "377", "MNG": "976", "MNE": "382", "MSR": "1", "MAR": "212", "MOZ": "258", "MMR": "95", "NAM": "264", "NRU": "674", "NPL": "977", "NLD": "31", "NCL": "687", "NZL": "64", "NIC": "505", "NER": "227", "NGA": "234", "NIU": "683", "NFK": "672", "MNP": "1", "NOR": "47", "OMN": "968", "PAK": "92", "PLW": "680", "PSE": "970", "PAN": "507", "PNG": "675", "PRY": "595", "PER": "51", "PHL": "63", "PCN": "64", "POL": "48", "PRT": "351", "PRI": "1", "QAT": "974", "REU": "262", "ROU": "40", "RUS": "7", "RWA": "250", "SHN": "290", "KNA": "1", "LCA": "1", "SPM": "508", "VCT": "1", "WSM": "685", "SMR": "378", "STP": "239", "SAU": "966", "SEN": "221", "SRB": "381", "SYC": "248", "SLE": "232", "SGP": "65", "SVK": "421", "SVN": "386", "SLB": "677", "SOM": "252", "ZAF": "27", "SGS": "500", "ESP": "34", "LKA": "94", "SUR": "597", "SJM": "47", "SWZ": "268", "SWE": "46", "CHE": "41", "TWN": "886", "TJK": "992", "TZA": "255", "THA": "66", "TLS": "670", "TGO": "228", "TKL": "690", "TON": "676", "TTO": "1", "TUN": "216", "TUR": "90", "TKM": "993", "TCA": "1", "TUV": "688", "UGA": "256", "UKR": "380", "ARE": "971", "GBR": "44", "USA": "1", "UMI": "1", "URY": "598", "UZB": "998", "VUT": "678", "VEN": "58", "VNM": "84", "VGB": "1", "VIR": "1", "WLF": "681", "ESH": "212", "YEM": "967", "ZMB": "260", "ZWE": "263"};

var sdcClients = require('sdc-clients');
var path = require('path');
var url = process.argv[2];
var bindDN = process.argv[3];
var password = process.argv[4];

if (process.argv.length !== 5) {
    var script = process.argv[0] + ' ' + path.basename(process.argv[1]);
    console.log('Usage: \n' +
                '    ' + script + ' ldaps://<ufds ip address> <ufds root username> <ufds root password>\n' +
                '    Example: ' + script + ' ldaps://10.0.0.12 cn=root secret');
    process.exit(1);
}
var ufds = new sdcClients.UFDS({
    "url": url,
    "bindDN": bindDN,
    "bindPassword": password
});

function getPhone(user) {
    return user.phone && user.phone.indexOf('+') !== 0 ? '+' + (map[user.country] || 1) + user.phone : false;
}

function analyze() {
    ufds.search('ou=users, o=smartdc', {scope: 'one', filter: '(&(objectclass=sdcperson)(|(login=*)(uuid=*)))'},
        function (err, entries) {
            if (err) {
                console.error(err);
                process.exit();
            }
            var count = 0;
            entries.forEach(function (user) {
                var phone = getPhone(user);
                if (phone) {
                    console.log('%s: %s', user.givenname, user.dn);
                    count += 1;
                }
            });
            console.log('Found %d records in %d', count, entries.length);
            ufds.close(function () {});
        });
}

ufds.once('connect', function () {
    analyze();
});

ufds.on('error', function (e) {
    console.log(e, 'can\'t connect to UFDS');
    process.exit(1);
});

ufds.on('timeout', function () {
    console.log('connection to UFDS timed out');
    process.exit(1);
});

