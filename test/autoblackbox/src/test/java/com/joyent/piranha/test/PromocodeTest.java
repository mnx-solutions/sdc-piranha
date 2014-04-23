package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.CreateAccountPage;
import com.joyent.piranha.pageobject.Login;
import com.joyent.piranha.pageobject.SignupBillingInformationPage;
import com.joyent.piranha.pageobject.SignupSshPage;
import com.joyent.piranha.util.TestWrapper;
import org.json.JSONException;
import org.junit.*;

import java.io.IOException;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

public class PromocodeTest extends TestWrapper {
    private static SignupBillingInformationPage signupBillingInformationPage;
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
        signupBillingInformationPage = createAccountPage.clickCreateAcccount(SignupBillingInformationPage.class);
    }

    @After
    public void finishTest() {
        Common.forceLogout();
    }

    @Test
    public void validPromocode() throws IOException, JSONException {
        signupBillingInformationPage.setPromotionalCode("NODE.JS CORE SUPPORT");
        signupBillingInformationPage.fillStepToPassCorrectly();
        signupBillingInformationPage.clickNextButton();
        page(SignupSshPage.class).checkTitle();
        signupBillingInformationPage.assertPromocode();
    }

    @Test
    public void invalidPromocode() {
        String invalidPromoCode = "invalid Promocode";
        signupBillingInformationPage.setPromotionalCode(invalidPromoCode);
        signupBillingInformationPage.fillStepToPassCorrectly();
        signupBillingInformationPage.clickNextButton();
        $(".modal").shouldHave(text("Billing information not updated: " + invalidPromoCode + " is not a valid promotional code"));
        assertTrue(signupBillingInformationPage.isErrorDisplayed("is not a valid promotional code"));
    }
}
