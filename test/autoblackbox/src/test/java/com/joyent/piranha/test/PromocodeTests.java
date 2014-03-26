package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobjects.SignupBillingInformationPageold;
import com.joyent.piranha.pageobjects.SignupPhoneConfirmationPageold;
import com.joyent.piranha.util.TestWrapper;
import org.json.JSONException;
import org.junit.After;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.IOException;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;

//TODO: refactor class to avoid code duplication with UserSignupTests
public class PromocodeTests extends TestWrapper {

    @BeforeClass
    public static void start() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
    }

    @Before
    public void beginTest() {
        $(byText("Create an Account")).click();
        SignupPhoneConfirmationPageold.goToBillingPage();
        SignupBillingInformationPageold.setCreditCardNumber("4111111111111111");
        SignupBillingInformationPageold.setExpireDate("5", "3");
        SignupBillingInformationPageold.setCCVCode("123");
        SignupBillingInformationPageold.setAddressLine1("st. testStreet");
        SignupBillingInformationPageold.setCity("Anchorage");
        SignupBillingInformationPageold.setState("Alaska");
        SignupBillingInformationPageold.setZipCode("99599");
    }

    @After
    public void finishTest() {
        Common.errorNotPresent();
        open("/landing/forgetToken");

    }

    @Test
    public void ValidPromocode() throws IOException, JSONException {
        SignupBillingInformationPageold.setPromotionalCode("NODE.JS CORE SUPPORT");
        SignupBillingInformationPageold.clickNextButton();
        $("button[data-ng-click=\"addNewKey()\"]").waitUntil(visible, 30000);
        SignupBillingInformationPageold.AssertPromocode();
    }

    @Test
    public void InvalidPromocode() {
        String promoCode = "invalid Promocode";
        SignupBillingInformationPageold.setPromotionalCode(promoCode);
        SignupBillingInformationPageold.clickNextButton();
        $("[data-ng-repeat=\"notification in group\"]").shouldHave(text("Billing information not updated: " + promoCode + " is not a valid promotional code"));
        $(byText("is not a valid promotional code")).shouldBe(visible);
    }
}