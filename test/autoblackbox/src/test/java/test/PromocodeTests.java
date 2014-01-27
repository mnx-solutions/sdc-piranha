package test;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;

import org.json.JSONException;
import org.junit.*;

import pageobjects.*;
import util.TestWrapper;

import java.io.*;

public class PromocodeTests extends TestWrapper {

    @BeforeClass
    public static void start(){
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
    }

    @Before
    public void beginTest(){
        $(byText("Create an Account")).click();
        PhoneConfirmationPage.goToBillingPage();
        PaymentInformationPage.setCreditCardNumber("4111111111111111");
        PaymentInformationPage.setExpireDate("5", "3");
        PaymentInformationPage.setCCVCode("123");
        PaymentInformationPage.setAddressLine1("st. testStreet");
        PaymentInformationPage.setCity("Anchorage");
        PaymentInformationPage.setState("Alaska");
        PaymentInformationPage.setZipCode("99599");
    }

    @After
    public void finishTest() {
        Common.errorNotPresent();
        open("/landing/forgetToken");

    }

    @Test
    public void ValidPromocode() throws IOException, JSONException {
        PaymentInformationPage.setPromotionalCode("NODE.JS CORE SUPPORT");
        PaymentInformationPage.nextBtnClick();
        $("button[data-ng-click=\"addNewKey()\"]").waitUntil(visible, 30000);
        PaymentInformationPage.AssertPromocode();
    }

    @Test
    public void InvalidPromocode(){
        String promoCode = "invalid Promocode";
        PaymentInformationPage.setPromotionalCode(promoCode);
        PaymentInformationPage.nextBtnClick();
        $("[data-ng-repeat=\"notification in group\"]").shouldHave(text("Billing information not updated: " + promoCode + " is not a valid promotional code"));
        $(byText("is not a valid promotional code")).shouldBe(visible);
    }
}