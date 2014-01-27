package pageobjects;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;


import com.codeborne.selenide.SelenideElement;

public class PhoneConfirmationPage {

    public static void verifyBtnClick() {
        $(byText("Verify")).click();
    }

    public static SelenideElement callMeNowBtn() {
        return $(byText("Call Me Now"));
    }

    public static void setPinCode(String pinCode) {
        SelenideElement pinCodeField = $("[data-ng-model=\"pin\"]");
        pinCodeField.clear();
        pinCodeField.sendKeys(pinCode);
    }

    public static void checkSelectedCountryCode(String countryCode) {
        $(".input-prepend span").shouldHave(text(countryCode));
    }

    public static void setPhoneNumber(String phoneNumber) {
        SelenideElement phoneNumberField = $("[data-ng-model=\"plainNumber\"]");
        phoneNumberField.clear();
        phoneNumberField.sendKeys(phoneNumber);
    }

    public static SelenideElement getError() {
        return $("[data-ng-repeat=\"notification in group\"]");
    }

    public static void goToBillingPage(){
        CreateAccount.createTestAccount();
        String phoneNumber = "6666666667";
        setPhoneNumber(phoneNumber);
        callMeNowBtn().waitUntil(enabled, 5000);
        callMeNowBtn().click();
        getError().shouldHave(text("Calling..."));
        setPinCode("1234");
        verifyBtnClick();
        getError().waitUntil(visible, 5000);
        getError().shouldHave(text("Phone verification failed. Incorrect PIN code. Please try again"));
        setPinCode(Common.getSmthingFromLog("generatedPin"));
        verifyBtnClick();
        $("[data-ng-model=\"plainNumber\"]").waitUntil(hasValue(phoneNumber), 5000);
    }
}