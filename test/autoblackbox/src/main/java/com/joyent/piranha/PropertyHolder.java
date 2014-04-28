package com.joyent.piranha;

public final class PropertyHolder {

    public static String getTestUserLogin() {
        return System.getProperty("loginusr");
    }

    public static String getTestUserPassword() {
        return System.getProperty("loginpw");
    }

    public static String getCorrectCardNumber() {
        return System.getProperty("cardNumber");
    }

    public static String getExpirationMonth() {
        return System.getProperty("expirationMonth");
    }

    public static String getExpirationYear() {
        return System.getProperty("expirationYear");
    }

    public static String getCCVCode() {
        return System.getProperty("ccvCode");
    }

    public static String getAddressLine1() {
        return System.getProperty("addressLine1");
    }

    public static String getCity() {
        return System.getProperty("city");
    }

    public static String getState() {
        return System.getProperty("state");
    }

    public static String getZipCode() {
        return System.getProperty("zipCode");
    }

    public static String getPhone() {
        return System.getProperty("phone");
    }

    public static String getZuoraUserName() {
        return System.getProperty("zuora.username");
    }

    public static String getZuoraUserPassword() {
        return System.getProperty("zuora.password");
    }

    public static String getZuoraBaseUrl() {
        return System.getProperty("zuora.baseurl");
    }

    public static String getDatacenter() {
        return System.getProperty("datacenter");
    }

    public static String getSdcPath() {
        return System.getProperty("pathToSdc");
    }
}
