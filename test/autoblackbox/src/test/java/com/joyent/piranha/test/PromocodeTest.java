package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.*;
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
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

public class PromocodeTest extends TestWrapper {
    private static Dashboard dashboard;
    private static EditBillingInformation editBillingInformation;
    @BeforeClass
    public static void start() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
    }

    @Before
    public void beginTest() {
        Login loginPage = open("/landing/signup/701800000015696", Login.class);
        final CreateAccountPage createAccountPage = page(CreateAccountPage.class);
        loginPage.createTestAccount(createAccountPage);
        dashboard = createAccountPage.clickCreateAcccount(Dashboard.class);
    }

    @After
    public void finishTest() {
        Common.forceLogout();
    }

    @Test
    public void validPromocode() throws IOException, JSONException {
        dashboard.getCompleteBillingButton().shouldBe(visible);
        editBillingInformation = dashboard.clickCompleteBillingButton();
        editBillingInformation.setPromotionalCode("NODE.JS CORE SUPPORT");
        editBillingInformation.waitForPageLoading();
        editBillingInformation.fillBillingInfoCorrectly();
        Account account = editBillingInformation.clickSaveChangesButton();
        editBillingInformation.clickButtonInModal("Ok");
        editBillingInformation.waitForMediumSpinnerDisappear();
        account.checkTitle();
        editBillingInformation.assertPromocode();
    }

    @Test
    public void invalidPromocode() {
        String invalidPromoCode = "invalid Promocode";
        editBillingInformation = dashboard.clickCompleteBillingButton();
        editBillingInformation.setPromotionalCode(invalidPromoCode);
        editBillingInformation.waitForPageLoading();
        editBillingInformation.fillBillingInfoCorrectly();
        editBillingInformation.clickSaveChangesButton();
        $(".modal").shouldHave(text("Billing information not updated: " + invalidPromoCode + " is not a valid promotional code"));
        assertTrue(dashboard.isErrorDisplayed("is not a valid promotional code"));
    }
}
