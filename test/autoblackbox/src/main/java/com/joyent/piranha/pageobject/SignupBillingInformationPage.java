package com.joyent.piranha.pageobject;

import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import org.apache.commons.codec.binary.Base64;
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
@Deprecated
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
        Select expirationMonth = new Select($(By.id("profile.billing.expirationMonth")));
        expirationMonth.selectByValue(monthValue);
        Select expirationYear = new Select($(By.id("profile.billing.expirationYear")));
        expirationYear.selectByValue(yearValue);
    }

    public void setCCVCode(String ccvcode) {
        setValue($(By.id("securityCode")), ccvcode);
    }

    public void setAddressLine1(String address) {
        setValue($(By.id("profile.billing.addressLine1")), address);
    }

    public void setCountry(String countryValue) {
        Select country = new Select($(By.id("country")));
        country.selectByVisibleText(countryValue);
    }

    public void setCity(String city) {
        setValue($(By.id("profile.billing.city")), city);
    }

    public void setState(String state) {
        Select stateSel = new Select($(By.id("stateSel")));
        stateSel.selectByVisibleText(state);
    }

    public void setZipCode(String zipCode) {
        setValue($(By.id("profile.billing.zipCode")), zipCode);
    }

    public void setPhone(String phone) {
        setValue($("[name=\"phone\"]"), phone);
    }

    public void waitForPageLoading() {
        //slowest elements on the page
        $("#firstName").waitUntil(not(empty), timeout);
        $("#lastName").waitUntil(not(empty), timeout);
    }

    public void assertPromocode() throws IOException, JSONException {
        String userId = Common.getValueFromLog("userId");
        String urlString = getZuoraSummaryUrl(userId);
        URL u = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) u.openConnection();
        conn.setRequestMethod("GET");
        final String basicAuth = Base64.encodeBase64String((PropertyHolder.getZuoraUserName() + ":" + PropertyHolder.getZuoraUserPassword()).getBytes());
        conn.addRequestProperty("Authorization", " Basic " + basicAuth);
        BufferedReader in = new BufferedReader(
                new InputStreamReader(conn.getInputStream()));
        String inputLine;
        StringBuilder response = new StringBuilder();

        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();
        JSONObject newJson = new JSONObject(response.toString());
        String ratePlanName = newJson.getJSONArray("subscriptions").getJSONObject(0).getJSONArray("ratePlans").getJSONObject(0).getString("ratePlanName");
        assertTrue(ratePlanName.equals("Free Trial"));
    }

    private String getZuoraSummaryUrl(String userId) {
        return String.format("%s/rest/v1/accounts/%s/summary", PropertyHolder.getZuoraBaseUrl(), userId);
    }

    public void fillStepToPassCorrectly() {
        setCreditCardNumber(PropertyHolder.getCorrectCardNumber());
        setExpireDate(PropertyHolder.getExpirationMonth(), PropertyHolder.getExpirationYear());
        setCCVCode(PropertyHolder.getCCVCode());
        setAddressLine1(PropertyHolder.getAddressLine1());
        setCity(PropertyHolder.getCity());
        setState(PropertyHolder.getState());
        setZipCode(PropertyHolder.getZipCode());
        setPhone(PropertyHolder.getPhone());
    }
}
