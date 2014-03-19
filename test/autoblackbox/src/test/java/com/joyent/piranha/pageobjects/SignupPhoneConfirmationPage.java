package com.joyent.piranha.pageobjects;

import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;

import static com.codeborne.selenide.Condition.enabled;
import static com.codeborne.selenide.Condition.hasValue;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class SignupPhoneConfirmationPage {

    public static void clickVerifyButton() {
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

    public static void goToBillingPage() {
        CreateAccount.createTestAccount();
        String phoneNumber = "6666666667";
        setPhoneNumber(phoneNumber);
        callMeNowBtn().waitUntil(enabled, 5000);
        callMeNowBtn().click();
        getError().shouldHave(text("Calling..."));
        setPinCode("1234");
        clickVerifyButton();
        getError().waitUntil(visible, 5000);
        getError().shouldHave(text("Phone verification failed. Incorrect PIN code. Please try again"));
        setPinCode(Common.getValueFromLog("generatedPin"));
        clickVerifyButton();
        $("[data-ng-model=\"plainNumber\"]").waitUntil(hasValue(phoneNumber), 5000);
    }
}