package com.joyent.piranha.pageobject;

import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import org.apache.commons.codec.binary.Base64;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

import static com.codeborne.selenide.Condition.empty;
import static com.codeborne.selenide.Condition.not;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;
import static junit.framework.Assert.assertTrue;

public class EditBillingInformation extends UserInfo {
    public static final String TITLE = "Edit Billing Information";

    @Override
    protected String getTitle() {
        return TITLE;
    }

    public void setPromotionalCode(String promoCode) {
        setValue($(By.id("promoCode")), promoCode);
    }

    public void fillBillingInfoCorrectly() {
        setCreditCardNumber(PropertyHolder.getCorrectCardNumber());
        setExpireDate(PropertyHolder.getExpirationMonth(), PropertyHolder.getExpirationYear());
        setCCVCode(PropertyHolder.getCCVCode());
        setAddressLine1(PropertyHolder.getAddressLine1());
        setCountry(PropertyHolder.getCountry());
        setCity(PropertyHolder.getCity());
        setState(PropertyHolder.getState());
        setZipCode(PropertyHolder.getZipCode());
        setPhone(PropertyHolder.getPhone());
    }

    public Account clickSaveChangesButton() {
        $(byText("Save Changes")).click();
        waitForMediumSpinnerDisappear();
        return page(Account.class);
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

    public void waitForPageLoading() {
        //slowest elements on the page
        $("#firstName").waitUntil(not(empty), timeout);
        $("#lastName").waitUntil(not(empty), timeout);
    }

    public String getCountry() {
        return $(".edit-country a span").text();
    }

    public String getState() {
        return $(".edit-state a span").text();
    }

    public String getCity() {
        return $("#city").val();
    }

    public String getZip() {
        return $("#zipCode").val();
    }
}
