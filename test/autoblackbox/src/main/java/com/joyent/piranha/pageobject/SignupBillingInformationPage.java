package com.joyent.piranha.pageobject;

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

import static com.codeborne.selenide.Condition.empty;
import static com.codeborne.selenide.Condition.not;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

public class SignupBillingInformationPage extends AbstractPageObject {

    public static final String TITLE = "Billing Information";

    @Override
    String getTitle() {
        return TITLE;
    }

    public SignupSshPage clickNextButton() {
        $("[data-ng-click=\"submitForm()\"]").click();
        return page(SignupSshPage.class);
    }

    public void setCreditCardNumber(String cardNumber) {
        setValue($("#creditCardNumber"), cardNumber);
    }

    public void setExpireDate(String monthValue, String yearValue) {
        Select expirationMonth = new Select($(By.id("expirationMonth")));
        expirationMonth.selectByValue(monthValue);
        Select expirationYear = new Select($(By.id("expirationYear")));
        expirationYear.selectByValue(yearValue);
    }

    public void setCCVCode(String ccvcode) {
        setValue($(By.id("securityCode")), ccvcode);
    }

    public void setAddressLine1(String address) {
        setValue($(By.id("addressLine1")), address);
    }

    public void setCountry(String countryValue) {
        Select country = new Select($(By.id("country")));
        country.selectByVisibleText(countryValue);
    }

    public void setCity(String city) {
        setValue($(By.id("city")), city);
    }

    public void setState(String state) {
        Select stateSel = new Select($(By.id("stateSel")));
        stateSel.selectByVisibleText(state);
    }

    public void setZipCode(String zipCode) {
        setValue($(By.id("zipCode")), zipCode);
    }

    public void setPhone(String phone) {
        setValue($("[name=\"phone\"]"), phone);
    }

    public void waitForPageLoading() {
        //slowest elements on the page
        $("#firstName").waitUntil(not(empty), timeout);
        $("#lastName").waitUntil(not(empty), timeout);
    }

    public void setPromotionalCode(String promoCode) {
        setValue($(By.id("promoCode")), promoCode);
    }

    public static void assertPromocode() throws IOException, JSONException {
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

    public void fillStepToPassCorrectly() {
        setCreditCardNumber("4111111111111111");
        setExpireDate("5", "3");
        setCCVCode("123");
        setAddressLine1("st. testStreet");
        setCity("Anchorage");
        setState("Alaska");
        setZipCode("99599");
        setPhone("23456789098765");
    }
}
