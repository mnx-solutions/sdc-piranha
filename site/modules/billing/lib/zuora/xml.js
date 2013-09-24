///--- naive xml object maker for zuora

/**
 * makes a CUD zuora object
 *
 *  @param {string} type - one of the following: create, update, delete
 *  @param {object} xmlObjects - output from makeZobject
 */

var makeCUD = module.exports.makeCUD = function (type, xmlObject){
  return '<' + type + '>' + xmlObject + '</' + type + '>';
}

/**
 *  makes a zuora object
 *
 *  @param {string} type - a namespaced xml tag (eg. zns:Account)
 *  @param {string} prefix - a namespace for the object's members
 *  @param {object} zObjects - the fields of the object
 */
var makeZobject = module.exports.makeZobject = function (type, prefix, zObjects) {
  var znstype = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="' + type + '"';

  function tag (name, prefix, value, attribs) {
    var pre = prefix ? prefix + ':' : '';
    var att = attribs ? ' ' + attribs : '';
    var val = value || '';
    return '<' + pre + name + att + '>' +
      val +
      '</' + pre + name + '>';
  }

  // Id fields must come first
  var fields = Object.keys(zObjects)
    .filter(function(field) {
      return field.search(/^id/i) !== -1;
    })
    .map(function(field) {
      return tag(field, prefix, zObjects[field]);
    })
    .join('\n');

  fields += '\n' + Object.keys(zObjects)
    .filter(function(field) {
      return zObjects[field] !== undefined && field.search(/^id/i) === -1;
    })
    .map(function(field) {
      return tag(field, prefix, zObjects[field]);
    })
    .join('\n');

  return tag('zObjects', 'zns', fields, znstype);
};

///--- example usage

// var accountId = '1';
// var address = {
//   street: 'street',
//   street2: 'street2',
//   city: 'van',
//   state: 'bc',
//   country: 'can'
// };
// var firstname = 'drew';
// var lastname = 'miller';
// var email = 'drew@joyent.com';
// 
// var z = makeZobject('zns:Contact','ons', {
//   AccountId:  accountId,
//   Address1:   address.street,
//   Address2:   address.street2,
//   City:       address.city,
//   PostalCode: address.state,
//   Country:    address.country,
//   FirstName:  firstname,
//   LastName:   lastname,
//   WorkEmail:  email
// });
// 
// console.log(z);

/*
<zns:zObjects zns:type="ons:Contact"><ons:AccountId>1</ons:AccountId>
<ons:Address1>street</ons:Address1>
<ons:Address2>street2</ons:Address2>
<ons:City>van</ons:City>
<ons:PostalCode>bc</ons:PostalCode>
<ons:Country>can</ons:Country>
<ons:FirstName>drew</ons:FirstName>
<ons:LastName>miller</ons:LastName>
<ons:WorkEmail>drew@joyent.com</ons:WorkEmail></zns:zObjects>
*/
