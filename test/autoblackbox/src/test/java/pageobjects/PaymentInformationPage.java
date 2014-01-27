package pageobjects;

import static com.codeborne.selenide.Selenide.$;
import static org.junit.Assert.assertTrue;

import com.codeborne.selenide.SelenideElement;

import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.Select;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class PaymentInformationPage {
    public static void nextBtnClick() {
        $("[data-ng-click=\"submitForm()\"]").click();
    }

    public static void setCreditCardNumber(String cardNumber) {
        SelenideElement element = $("#creditCardNumber");
        element.clear();
        element.sendKeys(cardNumber);
    }

    public static void setExpireDate(String monthValue, String yearValue) {
        Select Month = new Select($(By.id("expirationMonth")));
        Month.selectByValue(monthValue);
        Select Year = new Select($(By.id("expirationYear")));
        Year.selectByValue(yearValue);
    }

    public static void setCCVCode(String CCVCode) {
        SelenideElement element = $(By.id("securityCode"));
        element.clear();
        element.sendKeys(CCVCode);
    }

    public static void setAddressLine1(String address) {
        SelenideElement element = $(By.id("addressLine1"));
        element.clear();
        element.sendKeys(address);
    }

    public static void setCountry(String countryValue) {
            Select Country = new Select($(By.id("country")));
            Country.selectByValue(countryValue);
    }

    public static void setCity(String address) {
        SelenideElement element = $(By.id("city"));
        element.clear();
        element.sendKeys(address);
    }

    public static void setState(String state) {
            Select State = new Select($(By.id("stateSel")));
            State.selectByVisibleText(state);
    }

    public static void setZipCode(String zipCode) {
        SelenideElement element = $(By.id("zipCode"));
        element.clear();
        element.sendKeys(zipCode);
    }

    public static void setPromotionalCode(String promoCode) {
            SelenideElement element = $(By.id("promoCode"));
            element.clear();
            element.sendKeys(promoCode);
    }

    public static void AssertPromocode() throws IOException, JSONException {
        String userId = Common.getSmthingFromLog("userId");
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