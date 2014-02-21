package test;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.*;

import org.junit.*;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.Select;
import pageobjects.*;

public class UserSignupTests {
    private static final String BASE_URL = System.getProperty("endpoint");
    private static final int BASE_TIMEOUT = Integer.parseInt(System
            .getProperty("globaltimeout", "30000"));

    @BeforeClass
    public static void openSite() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
    }

    @Before
    public void goCreateAccountPage() {
        $("[data-ng-click=\"signup();\"]").click();
    }

    @After
    public void goToDashboard() {
        Common.errorNotPresent();
        open("/landing/forgetToken");
    }

    @AfterClass
    public static void logout() {
        open("/landing/forgetToken");
    }

    @Test
    public void createAccountValidation() {
        CreateAccount.createAcccountClick();
        $(By.id("firstName-errors")).shouldBe(visible);
        $(By.id("lastName-errors")).shouldBe(visible);
        $(By.id("email-errors")).shouldBe(visible);
        $(By.id("login-errors")).shouldBe(visible);
        $(By.id("firstName-errors")).shouldHave(text("First name is a required field"));
        $(By.id("lastName-errors")).shouldHave(text("Last name is a required field"));
        $(By.id("email-errors")).shouldHave(text("Incorrect E-mail!"));
        $(By.id("login-errors")).shouldHave(text("Username is a required field"));
        $(byAttribute("name", "password")).sendKeys("");
        $(byAttribute("name", "password2")).clear();
        $(byAttribute("name", "password2")).sendKeys("notthesameaspasword1");
        CreateAccount.createAcccountClick();
        $(By.id("password-errors")).shouldBe(visible);
        $(By.id("password-errors")).shouldHave(text("Passwords do not match. Password should have at least 7 characters. Password should have at least 1 alpha character. Password should have at least 1 numeric character."));
    }

    @Test
    public void PhoneConfirmationValidation() {
        CreateAccount.createTestAccount();
        SignupPhoneConfirmationPage.setPinCode("not a pin code");
        SignupPhoneConfirmationPage.clickVerifyButton();
        SignupPhoneConfirmationPage.getError().shouldHave(text("Phone verification failed. Incorrect PIN code. Please try again"));
        SignupPhoneConfirmationPage.checkSelectedCountryCode("(+1)");
        Select countries = new Select($(byAttribute("name", "countrySelect")));
        countries.selectByValue("8");
        SignupPhoneConfirmationPage.checkSelectedCountryCode("(+376)");
        SignupPhoneConfirmationPage.callMeNowBtn().shouldBe(disabled);
        SignupPhoneConfirmationPage.setPhoneNumber("!!!!!!!!!!!!!!!!!");
        SignupPhoneConfirmationPage.callMeNowBtn().click();
        SignupPhoneConfirmationPage.getError().shouldHave(text("The phone number is incorrect"));
        SignupPhoneConfirmationPage.setPhoneNumber("66666");
        SignupPhoneConfirmationPage.callMeNowBtn().shouldBe(enabled);
        SignupPhoneConfirmationPage.callMeNowBtn().click();
        SignupPhoneConfirmationPage.getError().shouldHave(text("Calling..."));
        SignupPhoneConfirmationPage.clickVerifyButton();
        SignupPhoneConfirmationPage.clickVerifyButton();
        SignupPhoneConfirmationPage.getError().shouldHave(text("Phone verification failed. Incorrect PIN code. PIN has been locked. Please use \"Call Me Now\" to get a new PIN."));
        SignupPhoneConfirmationPage.clickVerifyButton();
        SignupPhoneConfirmationPage.getError().shouldHave(text("Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support"));

    }

    @Test
    public void PaymentInformationValidation() {
        SignupPhoneConfirmationPage.goToBillingPage();
        SignupBillingInformationPage.clickNextButton();
        $(byText("Missing credit card number")).shouldBe(visible);
        $(byText("Missing security code")).shouldBe(visible);
        $(byText("Missing expiration info")).shouldBe(visible);
        $(byText("Missing address 1 line")).shouldBe(visible);
        $(byText("Missing city")).shouldBe(visible);
        $(byText("Missing state")).shouldBe(visible);
        $(byText("Missing zip code")).shouldBe(visible);
        SignupBillingInformationPage.setCreditCardNumber("!!!");
        SignupBillingInformationPage.clickNextButton();
        $(byText("Invalid symbols (numbers only)")).shouldBe(visible);
    }

    @Test
    public void passBillingStep() {
        SignupPhoneConfirmationPage.goToBillingPage();
        SignupBillingInformationPage.setCreditCardNumber("4111111111111111");
        SignupBillingInformationPage.setExpireDate("5", "3");
        SignupBillingInformationPage.setCCVCode("123");
        SignupBillingInformationPage.setAddressLine1("st. testStreet");
        SignupBillingInformationPage.setCity("Anchorage");
        SignupBillingInformationPage.setState("Alaska");
        SignupBillingInformationPage.setZipCode("99599");
        SignupBillingInformationPage.clickNextButton();
        $("button[data-ng-click=\"addNewKey()\"]").shouldBe(visible);
    }

    @Test
    public void blockedByBlackList() {
        SignupPhoneConfirmationPage.goToBillingPage();
        SignupBillingInformationPage.setCreditCardNumber("4111111111111111");
        SignupBillingInformationPage.setExpireDate("5", "3");
        SignupBillingInformationPage.setCCVCode("123");
        SignupBillingInformationPage.setAddressLine1("st. testStreet");
        SignupBillingInformationPage.setCountry("47");
        SignupBillingInformationPage.setCity("Anchorage");
        SignupBillingInformationPage.setZipCode("99599");
        SignupBillingInformationPage.clickNextButton();
        $("[data-ng-switch-when=\"blocked\"]").shouldBe(visible);
    }
}