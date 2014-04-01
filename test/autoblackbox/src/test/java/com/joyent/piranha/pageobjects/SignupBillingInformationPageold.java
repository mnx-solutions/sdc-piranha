package com.joyent.piranha.pageobjects;

import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.Select;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

import static com.codeborne.selenide.Selenide.$;
import static org.junit.Assert.assertTrue;

public class SignupBillingInformationPageold {
    public static void clickNextButton() {
        $("[data-ng-click=\"submitForm()\"]").click();
    }

    public static void setValue(SelenideElement fieldSelector, String value) {
        fieldSelector.clear();
        fieldSelector.sendKeys(value);
    }

    public static void setCreditCardNumber(String cardNumber) {
        setValue($("#creditCardNumber"), cardNumber);
    }

    public static void setExpireDate(String monthValue, String yearValue) {
        Select Month = new Select($(By.id("expirationMonth")));
        Month.selectByValue(monthValue);
        Select Year = new Select($(By.id("expirationYear")));
        Year.selectByValue(yearValue);
    }

    public static void setCCVCode(String CCVCode) {
        setValue($(By.id("securityCode")), CCVCode);
    }

    public static void setAddressLine1(String address) {
        setValue($(By.id("addressLine1")), address);
    }

    public static void setCountry(String countryValue) {
        Select Country = new Select($(By.id("country")));
        Country.selectByValue(countryValue);
    }

    public static void setCity(String city) {
        setValue($(By.id("city")), city);
    }

    public static void setState(String state) {
        Select State = new Select($(By.id("stateSel")));
        State.selectByVisibleText(state);
    }

    public static void setZipCode(String zipCode) {
        setValue($(By.id("zipCode")), zipCode);
    }

    public static void setPromotionalCode(String promoCode) {
        setValue($(By.id("promoCode")), promoCode);
    }

    public static void AssertPromocode() throws IOException, JSONException {
        String userId = Common.getValueFromLog("userId");
        String urlString = "https://apisandbox-api.zuora.com/rest/v1/accounts/" + userId + "/summary";
        URL u = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) u.openConnection();
        conn.setRequestMethod("GET");
        conn.addRequestProperty("Authorization", " Basic cGlyYW5oYS1hcGlAam95ZW50LmNvbTo5MDRXZXVnTTZVdzZoUld2");
        BufferedReader in = new BufferedReader(
                new InputStreamReader(conn.getInputStream()));
        String inputLine;
        StringBuffer response = new StringBuffer();

        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();
        JSONObject newJson = new JSONObject(response.toString());
        String ratePlanName = newJson.getJSONArray("subscriptions").getJSONObject(0).getJSONArray("ratePlans").getJSONObject(0).getString("ratePlanName");
        assertTrue(ratePlanName.equals("Free Trial"));
    }
}