package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.pageobjects.CreateAccount;
import com.joyent.piranha.pageobjects.SignupPhoneConfirmationPageold;
import com.joyent.piranha.util.TestWrapper;
import org.junit.*;
import org.openqa.selenium.support.ui.Select;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static org.junit.Assert.assertTrue;

public class UserSignupTest extends TestWrapper {

    private static Login loginPage;
    private static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openSite() {
        baseUrl = BASE_URL;
        timeout = BASE_TIMEOUT;
        loginPage = open("/", Login.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @After
    public void goToDashboard() {
        sideBarMenu.errorNotPresent();
        Common.forceLogout();
    }

    @AfterClass
    public static void logout() {
        Common.forceLogout();
    }

    @Test
    public void createAccountValidation() {
        CreateAccountPage createAccountPage = loginPage.clickSignUp();
        createAccountPage.clickCreateAcccount(SignupBillingInformationPage.class);
        assertTrue(createAccountPage.getErrorLabel().size() == $$("tr").size());
        assertTrue(createAccountPage.isErrorDisplayed("required field"));
        createAccountPage.setPassword("");
        createAccountPage.setConfirmPassword("notTheSamePass");
        createAccountPage.clickCreateAcccount(SignupBillingInformationPage.class);
        assertTrue(createAccountPage.isErrorDisplayed("Password mismatch"));
    }

    @Test
    public void paymentInformationValidation() {
        CreateAccountPage createAccountPage = loginPage.clickSignUp();
        loginPage.createTestAccount(createAccountPage);
        SignupBillingInformationPage signupBillInfoPage = createAccountPage.clickCreateAcccount(SignupBillingInformationPage.class);
        signupBillInfoPage.clickNextButton();
        signupBillInfoPage.waitForPageLoading();
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing credit card number"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing security code"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing expiration info"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing address 1 line"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing city"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing state"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing zip code"));
        assertTrue(signupBillInfoPage.isErrorDisplayed("Missing phone number"));
        signupBillInfoPage.setCreditCardNumber("!!!");
        signupBillInfoPage.clickNextButton();
        assertTrue(signupBillInfoPage.isErrorDisplayed("Please provide valid 16-digit card number"));
    }

    @Test
    public void passBillingStep() {
        CreateAccountPage createAccountPage = loginPage.clickSignUp();
        loginPage.createTestAccount(createAccountPage);
        SignupBillingInformationPage signupBillInfoPage = createAccountPage.clickCreateAcccount(SignupBillingInformationPage.class);
        signupBillInfoPage.waitForPageLoading();
        signupBillInfoPage.fillStepToPassCorrectly();
        SignupSshPage signupSshPage = signupBillInfoPage.clickNextButton();
        signupSshPage.checkTitle();
    }

    @Test
    public void blockedByBlackList() {
        CreateAccountPage createAccountPage = loginPage.clickSignUp();
        loginPage.createTestAccount(createAccountPage);
        SignupBillingInformationPage signupBillInfoPage = createAccountPage.clickCreateAcccount(SignupBillingInformationPage.class);
        signupBillInfoPage.waitForPageLoading();
        signupBillInfoPage.fillStepToPassCorrectly();
        signupBillInfoPage.setCountry("China");
        signupBillInfoPage.clickNextButton();
        $(byText("Failed")).shouldBe(visible);
    }

    @Test
    public void useExistingUsername(){
        CreateAccountPage createAccountPage = loginPage.clickSignUp();
        createAccountPage.setLogin(PropertyHolder.getTestUserLogin());
        createAccountPage.getSigninLink().shouldBe(visible);
        createAccountPage.getSigninLink().click();
        loginPage.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
        page(Dashboard.class).checkTitle();
    }

    @Test
    public void useExistingUsernameWithCampaignID(){
        open("/landing/signup/701800000015696");
        CreateAccountPage createAccountPage = page(CreateAccountPage.class);
        createAccountPage.setLogin(PropertyHolder.getTestUserLogin());
        createAccountPage.getSigninLink().shouldBe(visible);
        createAccountPage.getSigninLink().click();
        loginPage.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
        page(Dashboard.class).checkTitle();
    }

    @Ignore //for now PhoneConfirmation feature is turned off on production
    @Test
    public void phoneConfirmationValidation() {
        CreateAccount.createTestAccount();
        SignupPhoneConfirmationPageold.setPinCode("not a pin code");
        SignupPhoneConfirmationPageold.clickVerifyButton();
        SignupPhoneConfirmationPageold.getError().shouldHave(text("Phone verification failed. Incorrect PIN code. Please try again"));
        SignupPhoneConfirmationPageold.checkSelectedCountryCode("(+1)");
        Select countries = new Select($(byAttribute("name", "countrySelect")));
        countries.selectByValue("8");
        SignupPhoneConfirmationPageold.checkSelectedCountryCode("(+376)");
        SignupPhoneConfirmationPageold.callMeNowBtn().shouldBe(disabled);
        SignupPhoneConfirmationPageold.setPhoneNumber("!!!!!!!!!!!!!!!!!");
        SignupPhoneConfirmationPageold.callMeNowBtn().click();
        SignupPhoneConfirmationPageold.getError().shouldHave(text("The phone number is incorrect"));
        SignupPhoneConfirmationPageold.setPhoneNumber("66666");
        SignupPhoneConfirmationPageold.callMeNowBtn().shouldBe(enabled);
        SignupPhoneConfirmationPageold.callMeNowBtn().click();
        SignupPhoneConfirmationPageold.getError().shouldHave(text("Calling..."));
        SignupPhoneConfirmationPageold.clickVerifyButton();
        SignupPhoneConfirmationPageold.clickVerifyButton();
        SignupPhoneConfirmationPageold.getError().shouldHave(text("Phone verification failed. Incorrect PIN code. PIN has been locked. Please use \"Call Me Now\" to get a new PIN."));
        SignupPhoneConfirmationPageold.clickVerifyButton();
        SignupPhoneConfirmationPageold.getError().shouldHave(text("Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support"));
    }
}