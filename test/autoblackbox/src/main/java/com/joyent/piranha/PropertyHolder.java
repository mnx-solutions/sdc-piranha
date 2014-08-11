package com.joyent.piranha;

import java.util.Arrays;
import java.util.List;

public final class PropertyHolder {

    public static String getTestUserLogin() {
        return System.getProperty("profile.userLogin");
    }

    public static String getTestUserPassword() {
        return System.getProperty("profile.userPassword");
    }

    public static String getCorrectCardNumber() {
        return System.getProperty("profile.billing.cardNumber");
    }

    public static String getExpirationMonth() {
        return System.getProperty("profile.billing.expirationMonth");
    }

    public static String getExpirationYear() {
        return System.getProperty("profile.billing.expirationYear");
    }

    public static String getCCVCode() {
        return System.getProperty("profile.billing.ccvCode");
    }

    public static String getAddressLine1() {
        return System.getProperty("profile.billing.addressLine1");
    }

    public static String getCity() {
        return System.getProperty("profile.billing.city");
    }

    public static String getState() {
        return System.getProperty("profile.billing.state");
    }

    public static String getZipCode() {
        return System.getProperty("profile.billing.zipCode");
    }

    public static String getPhone() {
        return System.getProperty("profile.billing.phone");
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

    public static boolean containsDatacenter(int i, String... datacenters) {
        return Arrays.asList(datacenters).contains(getDatacenter(i));
    }

    public static String getDatacenter(int i) {
        return getDatacenters().get(i);
    }

    public static List<String> getDatacenters() {
        String[] datacenters = System.getProperty("server.datacenters").split("[,]");
        return Arrays.asList(datacenters);
    }

    public static String getSdcPath() {
        return System.getProperty("env.pathToSdc");
    }

    public static String getSdcKeyID() {
        return System.getProperty("sdc.keyID");
    }

    public static String getSdcURL(String datacenter) {
        return System.getProperty("sdc." + datacenter + ".url");
    }

    public static String getChangeStatusTimeout() {
        return System.getProperty("selenium.statustimeout", "240000");
    }

    public static String getPrivateKeyPath() {
        return getPathToSShFolder() + System.getProperty("env.privateKey");
    }

    public static String getGlobalTimeout() {
        return System.getProperty("selenium.globaltimeout", "40000");
    }

    public static String getServerLogPath() {
        return System.getProperty("env.serverLogPath");
    }

    public static String getBaseUrl() {
        return System.getProperty("server.endpoint");
    }

    public static String getPathToSShFolder() {
        return System.getProperty("env.sshFolderPath");
    }

    public static String getPublicKeyPath() {
        return getPathToSShFolder() +  System.getProperty("env.publicKeyPath");
    }

    public static String getCountry() {
        return System.getProperty("profile.billing.Country");
    }
}
